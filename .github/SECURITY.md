# Security Policy

## Supported Versions

Currently, we support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of our notification service seriously. If you believe you've found a security vulnerability, please follow these steps:

1. **Do not disclose the vulnerability publicly**
2. **Email us** at security@example.com with details about the vulnerability
3. Include the following information:
   - Type of vulnerability
   - Full paths of source file(s) related to the vulnerability
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the vulnerability

## Security Measures

Our notification service implements several security measures:

- **Authentication**: JWT-based authentication with proper token validation
- **Authorization**: Role-based access control for API endpoints
- **Input Validation**: All user inputs are validated and sanitized
- **Data Encryption**: Sensitive data is encrypted at rest and in transit
- **Dependency Scanning**: Regular automated scanning for vulnerabilities in dependencies
- **Rate Limiting**: Protection against brute force and DoS attacks

## Security Workflow

We have implemented an automated security workflow that runs:
- On each push to main/master branches
- On each pull request to main/master branches
- Weekly scheduled scans

This workflow includes:
- npm audit for dependency vulnerabilities
- OWASP Dependency-Check for deeper vulnerability scanning
- ESLint security plugin scanning for code security issues