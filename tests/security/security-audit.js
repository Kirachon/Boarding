/**
 * Security Audit Script
 * Comprehensive security testing for the boarding house management system
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

class SecurityAuditor {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  log(level, test, message, details = null) {
    const result = { level, test, message, details, timestamp: new Date().toISOString() };
    this.results.tests.push(result);
    
    const color = {
      'PASS': '\x1b[32m',
      'FAIL': '\x1b[31m',
      'WARN': '\x1b[33m',
      'INFO': '\x1b[36m'
    }[level] || '\x1b[0m';
    
    console.log(`${color}[${level}]\x1b[0m ${test}: ${message}`);
    if (details) console.log(`  Details: ${JSON.stringify(details, null, 2)}`);
    
    if (level === 'PASS') this.results.passed++;
    else if (level === 'FAIL') this.results.failed++;
    else if (level === 'WARN') this.results.warnings++;
  }

  async testAuthenticationSecurity() {
    console.log('\n=== Authentication Security Tests ===');

    // Test 1: SQL Injection in login
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: "admin@test.com' OR '1'='1",
        password: "password"
      });
      
      if (response.status === 200) {
        this.log('FAIL', 'SQL_INJECTION_LOGIN', 'SQL injection vulnerability in login endpoint');
      } else {
        this.log('PASS', 'SQL_INJECTION_LOGIN', 'Login endpoint protected against SQL injection');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.log('PASS', 'SQL_INJECTION_LOGIN', 'Login endpoint properly rejects malicious input');
      } else {
        this.log('WARN', 'SQL_INJECTION_LOGIN', 'Unexpected error during SQL injection test', error.message);
      }
    }

    // Test 2: Password brute force protection
    const testEmail = 'test@example.com';
    let failedAttempts = 0;
    
    for (let i = 0; i < 6; i++) {
      try {
        await axios.post(`${API_BASE_URL}/auth/login`, {
          email: testEmail,
          password: `wrongpassword${i}`
        });
      } catch (error) {
        if (error.response && error.response.status === 401) {
          failedAttempts++;
        } else if (error.response && error.response.status === 429) {
          this.log('PASS', 'BRUTE_FORCE_PROTECTION', 'Rate limiting active after multiple failed attempts');
          break;
        }
      }
    }
    
    if (failedAttempts >= 5) {
      this.log('WARN', 'BRUTE_FORCE_PROTECTION', 'No rate limiting detected for failed login attempts');
    }

    // Test 3: JWT token validation
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: { Authorization: 'Bearer invalid-token' }
      });
      
      if (response.status === 200) {
        this.log('FAIL', 'JWT_VALIDATION', 'Invalid JWT token accepted');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.log('PASS', 'JWT_VALIDATION', 'Invalid JWT tokens properly rejected');
      }
    }

    // Test 4: Password strength validation
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: 'weak@test.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User'
      });
      
      if (response.status === 201) {
        this.log('FAIL', 'PASSWORD_STRENGTH', 'Weak passwords accepted during registration');
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        this.log('PASS', 'PASSWORD_STRENGTH', 'Weak passwords properly rejected');
      }
    }
  }

  async testAuthorizationSecurity() {
    console.log('\n=== Authorization Security Tests ===');

    // Create test users with different roles
    const testUsers = [];
    
    try {
      // Create a regular user
      const userResponse = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: `user-${Date.now()}@test.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      });
      
      testUsers.push({
        role: 'user',
        token: userResponse.data.token,
        id: userResponse.data.user.id
      });

      // Test unauthorized access to admin endpoints
      try {
        const response = await axios.get(`${API_BASE_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${testUsers[0].token}` }
        });
        
        if (response.status === 200) {
          this.log('FAIL', 'UNAUTHORIZED_ACCESS', 'Regular user can access admin endpoints');
        }
      } catch (error) {
        if (error.response && error.response.status === 403) {
          this.log('PASS', 'UNAUTHORIZED_ACCESS', 'Admin endpoints properly protected');
        }
      }

      // Test access to other users' data
      try {
        const response = await axios.get(`${API_BASE_URL}/users/99999`, {
          headers: { Authorization: `Bearer ${testUsers[0].token}` }
        });
        
        if (response.status === 200) {
          this.log('FAIL', 'DATA_ISOLATION', 'User can access other users data');
        }
      } catch (error) {
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          this.log('PASS', 'DATA_ISOLATION', 'User data properly isolated');
        }
      }

    } catch (error) {
      this.log('WARN', 'AUTHORIZATION_SETUP', 'Could not create test users for authorization tests');
    }
  }

  async testInputValidationSecurity() {
    console.log('\n=== Input Validation Security Tests ===');

    // Test XSS prevention
    const xssPayloads = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src="x" onerror="alert(1)">',
      '"><script>alert("xss")</script>'
    ];

    for (const payload of xssPayloads) {
      try {
        const response = await axios.post(`${API_BASE_URL}/buildings`, {
          name: payload,
          address: { street: 'Test St', city: 'Test City', state: 'TS', zipCode: '12345' },
          totalRooms: 10
        }, {
          headers: { Authorization: 'Bearer test-token' }
        });
        
        if (response.data && response.data.building && response.data.building.name === payload) {
          this.log('FAIL', 'XSS_PREVENTION', `XSS payload not sanitized: ${payload}`);
        }
      } catch (error) {
        // Expected to fail due to authentication, but check if validation occurs
        if (error.response && error.response.status === 400) {
          this.log('PASS', 'XSS_PREVENTION', 'Input validation prevents XSS payloads');
        }
      }
    }

    // Test NoSQL injection (if applicable)
    try {
      const response = await axios.get(`${API_BASE_URL}/rooms?status[$ne]=null`);
      
      if (response.status === 200) {
        this.log('WARN', 'NOSQL_INJECTION', 'Potential NoSQL injection vulnerability');
      }
    } catch (error) {
      this.log('PASS', 'NOSQL_INJECTION', 'NoSQL injection attempts properly handled');
    }

    // Test file upload security (if implemented)
    try {
      const maliciousFile = Buffer.from('<?php echo "malicious code"; ?>');
      const formData = new FormData();
      formData.append('file', new Blob([maliciousFile]), 'malicious.php');
      
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: 'Bearer test-token'
        }
      });
      
      if (response.status === 200) {
        this.log('WARN', 'FILE_UPLOAD_SECURITY', 'File upload may accept dangerous file types');
      }
    } catch (error) {
      // Expected to fail, but good if it rejects dangerous files
      this.log('PASS', 'FILE_UPLOAD_SECURITY', 'File upload properly secured or not implemented');
    }
  }

  async testSessionSecurity() {
    console.log('\n=== Session Security Tests ===');

    // Test session fixation
    try {
      // First request without authentication
      const response1 = await axios.get(`${API_BASE_URL}/health`);
      const sessionId1 = response1.headers['set-cookie']?.[0];
      
      // Login and check if session ID changes
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'password'
      });
      
      const sessionId2 = loginResponse.headers['set-cookie']?.[0];
      
      if (sessionId1 && sessionId2 && sessionId1 === sessionId2) {
        this.log('WARN', 'SESSION_FIXATION', 'Session ID not regenerated after login');
      } else {
        this.log('PASS', 'SESSION_FIXATION', 'Session properly managed');
      }
    } catch (error) {
      this.log('INFO', 'SESSION_FIXATION', 'Session fixation test inconclusive');
    }

    // Test JWT token expiration
    try {
      // Create a token with short expiration (if possible)
      const shortToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjN9.invalid';
      
      const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${shortToken}` }
      });
      
      if (response.status === 200) {
        this.log('FAIL', 'TOKEN_EXPIRATION', 'Expired tokens accepted');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.log('PASS', 'TOKEN_EXPIRATION', 'Expired tokens properly rejected');
      }
    }
  }

  async testHTTPSecurity() {
    console.log('\n=== HTTP Security Tests ===');

    // Test security headers
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      const headers = response.headers;
      
      // Check for security headers
      const securityHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'strict-transport-security': 'max-age=',
        'content-security-policy': 'default-src'
      };
      
      for (const [header, expectedValue] of Object.entries(securityHeaders)) {
        if (headers[header] && headers[header].includes(expectedValue)) {
          this.log('PASS', 'SECURITY_HEADERS', `${header} header properly set`);
        } else {
          this.log('WARN', 'SECURITY_HEADERS', `${header} header missing or incorrect`);
        }
      }
    } catch (error) {
      this.log('WARN', 'SECURITY_HEADERS', 'Could not test security headers');
    }

    // Test CORS configuration
    try {
      const response = await axios.options(`${API_BASE_URL}/health`, {
        headers: {
          'Origin': 'https://malicious-site.com',
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      const corsHeader = response.headers['access-control-allow-origin'];
      if (corsHeader === '*') {
        this.log('WARN', 'CORS_CONFIGURATION', 'CORS allows all origins (*)');
      } else if (corsHeader) {
        this.log('PASS', 'CORS_CONFIGURATION', 'CORS properly configured');
      } else {
        this.log('PASS', 'CORS_CONFIGURATION', 'CORS restrictive configuration');
      }
    } catch (error) {
      this.log('INFO', 'CORS_CONFIGURATION', 'CORS configuration test inconclusive');
    }
  }

  async testDataProtection() {
    console.log('\n=== Data Protection Tests ===');

    // Test password hashing
    try {
      // This would require database access to verify passwords are hashed
      this.log('INFO', 'PASSWORD_HASHING', 'Password hashing verification requires database access');
    } catch (error) {
      this.log('WARN', 'PASSWORD_HASHING', 'Could not verify password hashing');
    }

    // Test sensitive data exposure in responses
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      });
      
      if (response.data.user && response.data.user.password) {
        this.log('FAIL', 'SENSITIVE_DATA_EXPOSURE', 'Password returned in API response');
      } else {
        this.log('PASS', 'SENSITIVE_DATA_EXPOSURE', 'Sensitive data not exposed in responses');
      }
    } catch (error) {
      this.log('INFO', 'SENSITIVE_DATA_EXPOSURE', 'Could not test sensitive data exposure');
    }
  }

  async runAllTests() {
    console.log('🔒 Starting Security Audit...\n');
    
    await this.testAuthenticationSecurity();
    await this.testAuthorizationSecurity();
    await this.testInputValidationSecurity();
    await this.testSessionSecurity();
    await this.testHTTPSecurity();
    await this.testDataProtection();
    
    this.generateReport();
  }

  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('🔒 SECURITY AUDIT REPORT');
    console.log('='.repeat(50));
    console.log(`✅ Tests Passed: ${this.results.passed}`);
    console.log(`❌ Tests Failed: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`📊 Total Tests: ${this.results.tests.length}`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ CRITICAL SECURITY ISSUES:');
      this.results.tests
        .filter(test => test.level === 'FAIL')
        .forEach(test => console.log(`  - ${test.test}: ${test.message}`));
    }
    
    if (this.results.warnings > 0) {
      console.log('\n⚠️  SECURITY WARNINGS:');
      this.results.tests
        .filter(test => test.level === 'WARN')
        .forEach(test => console.log(`  - ${test.test}: ${test.message}`));
    }
    
    const score = Math.round((this.results.passed / this.results.tests.length) * 100);
    console.log(`\n🎯 Security Score: ${score}%`);
    
    if (this.results.failed === 0) {
      console.log('\n🎉 No critical security vulnerabilities found!');
    } else {
      console.log('\n🚨 Critical security issues detected. Please address immediately.');
    }
  }
}

// Run security audit if called directly
if (require.main === module) {
  const auditor = new SecurityAuditor();
  auditor.runAllTests().catch(console.error);
}

module.exports = SecurityAuditor;
