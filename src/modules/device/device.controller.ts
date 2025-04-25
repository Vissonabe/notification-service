import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { Device } from './schemas/device.schema';

@ApiTags('devices')
@Controller('devices')
export class DeviceController {
  private readonly logger = new Logger(DeviceController.name);

  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new device or update an existing one' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Device successfully registered',
    type: Device
  })
  async registerDevice(@Body() registerDeviceDto: RegisterDeviceDto): Promise<{ device_id: string, status: string }> {
    this.logger.log('Register device request received');
    const device = await this.deviceService.registerDevice(registerDeviceDto);
    return {
      device_id: device._id ? device._id.toString() : '',
      status: 'registered'
    };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all devices for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of devices for the user',
    type: [Device]
  })
  async getUserDevices(@Param('userId') userId: string): Promise<Device[]> {
    this.logger.log(`Get devices for user ${userId}`);
    return this.deviceService.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a device by ID' })
  @ApiParam({ name: 'id', description: 'Device ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Device found',
    type: Device
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Device not found'
  })
  async getDevice(@Param('id') id: string): Promise<Device> {
    this.logger.log(`Get device ${id}`);
    return this.deviceService.findById(id);
  }

  @Put(':id/preferences')
  @ApiOperation({ summary: 'Update notification preferences for a device' })
  @ApiParam({ name: 'id', description: 'Device ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated',
    type: Device
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Device not found'
  })
  async updatePreferences(
    @Param('id') id: string,
    @Body() preferences: any
  ): Promise<Device> {
    this.logger.log(`Update preferences for device ${id}`);
    return this.deviceService.updateNotificationPreferences(id, preferences);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a device' })
  @ApiParam({ name: 'id', description: 'Device ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Device deleted'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Device not found'
  })
  async deleteDevice(@Param('id') id: string): Promise<void> {
    this.logger.log(`Delete device ${id}`);
    return this.deviceService.delete(id);
  }
}