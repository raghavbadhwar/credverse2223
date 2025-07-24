const express = require('express');
const { requireRole, requireInstitution } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase client
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

/**
 * @route GET /api/institutions/profile
 * @desc Get institution profile
 * @access Institution only
 */
router.get('/profile', requireInstitution, async (req, res, next) => {
  try {
    let institution = null;
    
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.user.id)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: 'Institution not found'
        });
      }

      institution = data;
    } else {
      // Mock data for development
      institution = {
        id: req.user.id,
        name: 'Sample University',
        email: req.user.email,
        institutionName: 'Sample University',
        walletAddress: req.user.walletAddress,
        isVerified: false
      };
    }

    res.json({
      success: true,
      data: {
        id: institution.id,
        name: institution.name,
        email: institution.email,
        institutionName: institution.institution_name,
        walletAddress: institution.wallet_address,
        did: institution.did,
        isVerified: institution.is_verified,
        isActive: institution.is_active,
        createdAt: institution.created_at,
        lastLogin: institution.last_login
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/institutions/profile
 * @desc Update institution profile
 * @access Institution only
 */
router.put('/profile', requireInstitution, async (req, res, next) => {
  try {
    const {
      institutionName,
      description,
      website,
      logo,
      contactEmail,
      contactPhone
    } = req.body;

    const updateData = {
      institution_name: institutionName,
      description,
      website,
      logo,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', req.user.id)
        .select()
        .single();

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Failed to update profile'
        });
      }

      res.json({
        success: true,
        data: {
          id: data.id,
          institutionName: data.institution_name,
          description: data.description,
          website: data.website,
          logo: data.logo,
          contactEmail: data.contact_email,
          contactPhone: data.contact_phone
        },
        message: 'Profile updated successfully'
      });
    } else {
      res.json({
        success: true,
        data: updateData,
        message: 'Profile updated successfully (mock)'
      });
    }

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/institutions/stats
 * @desc Get institution statistics
 * @access Institution only
 */
router.get('/stats', requireInstitution, async (req, res, next) => {
  try {
    // Mock statistics - implement with real data
    const stats = {
      credentialsIssued: 245,
      studentsCredentialed: 189,
      verificationsThisMonth: 67,
      activeCredentials: 238,
      revokedCredentials: 7,
      popularCredentialTypes: [
        { type: 'Bachelor Degree', count: 89 },
        { type: 'Master Degree', count: 45 },
        { type: 'Certificate', count: 67 },
        { type: 'Diploma', count: 44 }
      ],
      monthlyIssuance: [
        { month: 'Jan', count: 23 },
        { month: 'Feb', count: 34 },
        { month: 'Mar', count: 45 },
        { month: 'Apr', count: 56 },
        { month: 'May', count: 34 },
        { month: 'Jun', count: 53 }
      ]
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/institutions/verify-requests
 * @desc Get pending verification requests (admin only)
 * @access Admin only
 */
router.get('/verify-requests', requireRole('admin'), async (req, res, next) => {
  try {
    let institutions = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'institution')
        .eq('is_verified', false)
        .order('created_at', { ascending: false });

      if (!error) {
        institutions = data.map(inst => ({
          id: inst.id,
          name: inst.name,
          institutionName: inst.institution_name,
          email: inst.email,
          walletAddress: inst.wallet_address,
          createdAt: inst.created_at,
          website: inst.website,
          description: inst.description
        }));
      }
    } else {
      // Mock data
      institutions = [
        {
          id: 'inst-1',
          name: 'Harvard University',
          institutionName: 'Harvard University',
          email: 'admin@harvard.edu',
          walletAddress: '0x123...',
          createdAt: new Date().toISOString()
        }
      ];
    }

    res.json({
      success: true,
      data: institutions
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/institutions/:id/verify
 * @desc Verify an institution (admin only)
 * @access Admin only
 */
router.post('/:id/verify', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { verified, reason } = req.body;

    if (typeof verified !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Verified status (boolean) is required'
      });
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .update({
          is_verified: verified,
          verification_reason: reason,
          verified_at: verified ? new Date().toISOString() : null,
          verified_by: req.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('role', 'institution')
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: 'Institution not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: data.id,
          institutionName: data.institution_name,
          isVerified: data.is_verified,
          verifiedAt: data.verified_at,
          reason: data.verification_reason
        },
        message: `Institution ${verified ? 'verified' : 'rejected'} successfully`
      });
    } else {
      res.json({
        success: true,
        data: { id, verified, reason },
        message: `Institution ${verified ? 'verified' : 'rejected'} successfully (mock)`
      });
    }

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/institutions/public/:id
 * @desc Get public institution information
 * @access Public
 */
router.get('/public/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    let institution = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('id, institution_name, description, website, logo, is_verified, created_at')
        .eq('id', id)
        .eq('role', 'institution')
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: 'Institution not found'
        });
      }

      institution = data;
    } else {
      // Mock data
      institution = {
        id,
        institution_name: 'Sample University',
        description: 'Leading educational institution',
        website: 'https://sample-university.edu',
        logo: null,
        is_verified: true,
        created_at: new Date().toISOString()
      };
    }

    res.json({
      success: true,
      data: {
        id: institution.id,
        name: institution.institution_name,
        description: institution.description,
        website: institution.website,
        logo: institution.logo,
        isVerified: institution.is_verified,
        establishedAt: institution.created_at
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;