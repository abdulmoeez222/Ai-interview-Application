import { Injectable } from '@nestjs/common';
import { VoiceProfile } from '../interfaces/speech.interface';

@Injectable()
export class VoiceManagerService {
  private readonly voiceProfiles: Record<string, VoiceProfile> = {
    professional: {
      id: 'EXAVITQu4vr4xnSDxMaL',
      name: 'Ava Professional',
      description: 'Clear, professional tone for technical interviews',
      settings: {
        stability: 0.6,
        similarity: 0.8,
        style: 0.2,
      },
    },
    friendly: {
      id: 'ThT5KcBeYPX3keUQqHPh',
      name: 'Ava Friendly',
      description: 'Warm, encouraging tone for nervous candidates',
      settings: {
        stability: 0.5,
        similarity: 0.75,
        style: 0.4,
      },
    },
    energetic: {
      id: '21m00Tcm4TlvDq8ikWAM',
      name: 'Ava Energetic',
      description: 'Enthusiastic, upbeat for sales interviews',
      settings: {
        stability: 0.4,
        similarity: 0.7,
        style: 0.6,
      },
    },
  };

  /**
   * Get voice profile by name
   */
  getVoiceProfile(profileName: string): VoiceProfile {
    return (
      this.voiceProfiles[profileName.toLowerCase()] ||
      this.voiceProfiles.professional
    );
  }

  /**
   * Get all available voice profiles
   */
  getAllProfiles(): VoiceProfile[] {
    return Object.values(this.voiceProfiles);
  }

  /**
   * Get appropriate voice profile for job domain
   */
  getProfileForJobRole(domain: string): VoiceProfile {
    const mapping: Record<string, string> = {
      ENGINEERING: 'professional',
      CUSTOMER_SUPPORT_AND_SALES: 'friendly',
      CUSTOMER_SUPPORT: 'friendly',
      SALES: 'energetic',
      MARKETING: 'friendly',
      PRODUCT: 'professional',
      DESIGN: 'friendly',
      DATA_SCIENCE: 'professional',
      OPERATIONS: 'professional',
      HUMAN_RESOURCES: 'friendly',
      FINANCE: 'professional',
      LEGAL: 'professional',
      OTHER: 'professional',
    };

    const profileName = mapping[domain] || 'professional';
    return this.voiceProfiles[profileName];
  }

  /**
   * Get voice profile by ID
   */
  getProfileById(voiceId: string): VoiceProfile | null {
    for (const profile of Object.values(this.voiceProfiles)) {
      if (profile.id === voiceId) {
        return profile;
      }
    }
    return null;
  }
}

