import { Response } from 'express';
import { assessPriority, PriorityInput } from '../ai/priorityEngine';
import { PriorityAssessment } from '../models/PriorityAssessment';
import { Patient } from '../models/Patient';
import { AuthRequest } from '../middleware/auth';

export const assessPatientPriority = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { symptoms, reason, age, gender, medicalHistory, urgencyLevel, appointmentId } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, message: 'Reason is required' });
      return;
    }

    const input: PriorityInput = {
      symptoms: symptoms || [],
      reason,
      age,
      gender,
      medicalHistory: medicalHistory || [],
      urgencyLevel,
    };

    const result = assessPriority(input);

    // Save assessment
    const assessment = await PriorityAssessment.create({
      appointmentId: appointmentId || undefined,
      inputData: input,
      suggestedPriority: result.priority,
      confidence: result.confidence,
      reason: result.reason,
      factors: result.factors,
      requiresHumanReview: result.requiresHumanReview,
    });

    res.json({
      success: true,
      assessment: {
        id: assessment._id,
        priority: result.priority,
        confidence: result.confidence,
        reason: result.reason,
        factors: result.factors,
        requiresHumanReview: result.requiresHumanReview,
      },
    });
  } catch (error) {
    console.error('AI assessment error:', error);
    res.status(500).json({ success: false, message: 'Failed to perform priority assessment' });
  }
};

export const reviewAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { finalPriority, reviewerNotes } = req.body;

    const assessment = await PriorityAssessment.findByIdAndUpdate(
      req.params.id,
      {
        finalPriority,
        reviewerNotes,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
      },
      { new: true }
    );

    if (!assessment) {
      res.status(404).json({ success: false, message: 'Assessment not found' });
      return;
    }

    res.json({ success: true, assessment });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to review assessment' });
  }
};
