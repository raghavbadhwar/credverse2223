const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');
const veramoService = require('../services/veramoService');

const router = express.Router();

// Initialize Supabase client
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

/**
 * @route POST /api/auth/register
 * @desc Register a new user (institution or individual)
 * @access Public
 */
router.post('/register', async (req, res, next) => {
  try {
    const {
      email,
      password,
      name,
      role, // 'institution', 'student', 'verifier'
      institutionName,
      walletAddress
    } = req.body;

    // Validate required fields
    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, name, role'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Validate wallet address if provided
    if (walletAddress && !ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    // Check if user already exists
    if (supabase) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists'
        });
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create DID for user
    let userDID = null;
    try {
      if (role === 'institution') {
        const didResult = await veramoService.createInstitutionDID(
          institutionName || name,
          walletAddress
        );
        userDID = didResult.did;
      } else {
        const didResult = await veramoService.createStudentDID(email);
        userDID = didResult.did;
      }
    } catch (error) {
      console.error('Failed to create DID:', error);
      // Continue without DID for now
    }

    // Create user in database
    const userData = {
      email,
      password_hash: hashedPassword,
      name,
      role,
      wallet_address: walletAddress,
      did: userDID,
      institution_name: role === 'institution' ? (institutionName || name) : null,
      is_active: true,
      is_verified: false, // Institutions need manual verification
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let userId;
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to create user account'
        });
      }

      userId = data.id;
    } else {
      // Mock user ID for development
      userId = `user_${Date.now()}`;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: userId,
        email,
        role,
        walletAddress,
        institutionId: role === 'institution' ? userId : null
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: userId,
          email,
          name,
          role,
          walletAddress,
          did: userDID,
          isVerified: false
        },
        token
      },
      message: 'User registered successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login user with email and password
 * @access Public
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Get user from database
    let user = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      user = data;
    } else {
      // Mock user for development
      return res.status(500).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        walletAddress: user.wallet_address,
        institutionId: user.role === 'institution' ? user.id : null
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    if (supabase) {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          walletAddress: user.wallet_address,
          did: user.did,
          isVerified: user.is_verified,
          institutionName: user.institution_name
        },
        token
      },
      message: 'Login successful'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/wallet-connect
 * @desc Connect/verify wallet address with signature
 * @access Public
 */
router.post('/wallet-connect', async (req, res, next) => {
  try {
    const { walletAddress, signature, message, email } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address, signature, and message are required'
      });
    }

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    try {
      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Failed to verify signature'
      });
    }

    // Check if wallet is already connected to an account
    let user = null;
    if (supabase) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      user = data;
    }

    if (user) {
      // Existing user - generate token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          walletAddress: user.wallet_address,
          institutionId: user.role === 'institution' ? user.id : null
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            walletAddress: user.wallet_address,
            did: user.did,
            isVerified: user.is_verified
          },
          token,
          isNewUser: false
        },
        message: 'Wallet connected successfully'
      });
    }

    // New wallet - create temporary session or require registration
    if (email) {
      // If email provided, link to existing account
      if (supabase) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (existingUser) {
          // Update user with wallet address
          const { data, error } = await supabase
            .from('users')
            .update({ wallet_address: walletAddress })
            .eq('id', existingUser.id)
            .select()
            .single();

          if (!error) {
            const token = jwt.sign(
              {
                id: data.id,
                email: data.email,
                role: data.role,
                walletAddress: data.wallet_address,
                institutionId: data.role === 'institution' ? data.id : null
              },
              process.env.JWT_SECRET,
              { expiresIn: '7d' }
            );

            return res.json({
              success: true,
              data: {
                user: {
                  id: data.id,
                  email: data.email,
                  name: data.name,
                  role: data.role,
                  walletAddress: data.wallet_address,
                  did: data.did,
                  isVerified: data.is_verified
                },
                token,
                isNewUser: false
              },
              message: 'Wallet linked to existing account'
            });
          }
        }
      }
    }

    // Return wallet address for new user registration
    res.json({
      success: true,
      data: {
        walletAddress,
        isNewUser: true,
        requiresRegistration: true
      },
      message: 'Wallet verified. Please complete registration.'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh JWT token
 * @access Private
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { token: oldToken } = req.body;

    if (!oldToken) {
      return res.status(401).json({
        success: false,
        error: 'Token is required'
      });
    }

    try {
      const decoded = jwt.verify(oldToken, process.env.JWT_SECRET);
      
      // Generate new token
      const newToken = jwt.sign(
        {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          walletAddress: decoded.walletAddress,
          institutionId: decoded.institutionId
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        data: { token: newToken },
        message: 'Token refreshed successfully'
      });

    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Send password reset email
 * @access Public
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Check if user exists
    if (supabase) {
      const { data: user } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .single();

      if (!user) {
        // Don't reveal if email exists for security
        return res.json({
          success: true,
          message: 'If the email exists, a reset link has been sent.'
        });
      }

      // Generate reset token (implement email sending)
      // This is a placeholder - implement actual email sending
      console.log(`Password reset requested for: ${email}`);
    }

    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent.'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;