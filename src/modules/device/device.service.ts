import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device } from './schemas/device.schema';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DevicePlatform } from '../../shared/interfaces/device.interface';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    @InjectModel(Device.name) private deviceModel: Model<Device>,
  ) {}

  /**
   * Register a new device or update if device token already exists
   */
  async registerDevice(registerDeviceDto: RegisterDeviceDto): Promise<Device> {
    this.logger.log(`Registering device for user ${registerDeviceDto.user_id}`);
    
    // Check if device already exists by token
    const existingDevice = await this.deviceModel.findOne({
      device_token: registerDeviceDto.device_token,
    });

    if (existingDevice) {
      this.logger.log(`Updating existing device ${existingDevice._id}`);
      
      // Update existing device
      Object.assign(existingDevice, {
        ...registerDeviceDto,
        notification_preferences: {
          ...existingDevice.notification_preferences,
          ...(registerDeviceDto.notification_preferences || {}),
        },
        last_seen: new Date(),
      });

      return existingDevice.save();
    }

    // Create new device
    const newDevice = new this.deviceModel({
      ...registerDeviceDto,
      last_seen: new Date(),
    });

    return newDevice.save();
  }

  /**
   * Find all devices for a user
   */
  async findByUserId(userId: string): Promise<Device[]> {
    this.logger.debug(`Finding devices for user ${userId}`);
    return this.deviceModel.find({ user_id: userId }).exec();
  }

  /**
   * Find a specific device by ID
   */
  async findById(deviceId: string): Promise<Device> {
    this.logger.debug(`Finding device by ID ${deviceId}`);
    const device = await this.deviceModel.findById(deviceId).exec();
    
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }
    
    return device;
  }

  /**
   * Update a device's last seen timestamp
   */
  async updateLastSeen(deviceId: string): Promise<Device> {
    this.logger.debug(`Updating last seen for device ${deviceId}`);
    const device = await this.deviceModel.findByIdAndUpdate(
      deviceId,
      { last_seen: new Date() },
      { new: true }
    ).exec();
    
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }
    
    return device;
  }

  /**
   * Update a device's notification preferences
   */
  async updateNotificationPreferences(
    deviceId: string, 
    preferences: Partial<Device['notification_preferences']>
  ): Promise<Device> {
    this.logger.debug(`Updating notification preferences for device ${deviceId}`);
    
    const device = await this.deviceModel.findById(deviceId).exec();
    
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }
    
    // Merge existing preferences with new preferences
    device.notification_preferences = {
      ...device.notification_preferences,
      ...preferences,
    };
    
    return device.save();
  }

  /**
   * Find devices by platform (for sending notifications)
   */
  async findByPlatform(platform: DevicePlatform): Promise<Device[]> {
    this.logger.debug(`Finding devices by platform ${platform}`);
    return this.deviceModel.find({ platform }).exec();
  }

  /**
   * Delete a device
   */
  async delete(deviceId: string): Promise<void> {
    this.logger.log(`Deleting device ${deviceId}`);
    const result = await this.deviceModel.deleteOne({ _id: deviceId }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }
  }

  /**
   * Find devices by multiple IDs
   */
  async findByIds(deviceIds: string[]): Promise<Device[]> {
    this.logger.debug(`Finding devices by IDs: ${deviceIds.join(', ')}`);
    return this.deviceModel.find({
      _id: { $in: deviceIds },
    }).exec();
  }

  /**
   * Check if a device token is valid
   */
  async isTokenValid(deviceToken: string): Promise<boolean> {
    const device = await this.deviceModel.findOne({ device_token: deviceToken }).exec();
    return !!device;
  }
} 