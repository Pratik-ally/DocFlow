import { Response } from 'express';
import { assessPriority, PriorityInput } from '../ai/priorityEngine';
import { PriorityAssessment } from '../models/PriorityAssessment';
import { Patient } from '../models/Patient';
import { Appointment } from '../models/Appointment';
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
    let hospitalId = req.user?.hospitalId;
    if (appointmentId) {
      const appointment = await Appointment.findOne({
        _id: appointmentId,
        ...(req.user?.role === 'PATIENT'
          ? { patientId: (await Patient.findOne({ userId: req.user.id }).select('_id'))?._id }
          : { hospitalId }),
      }).select('hospitalId');
      if (!appointment) {
        res.status(404).json({ success: false, message: 'Appointment not found' });
        return;
      }
      hospitalId = appointment.hospitalId.toString();
    }

    // Save assessment
    const assessment = await PriorityAssessment.create({
      appointmentId: appointmentId || undefined,
      hospitalId,
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
    console.error('AI assessment failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({ success: false, message: 'Failed to perform priority assessment' });
  }
};

export const reviewAssessment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { finalPriority, reviewerNotes } = req.body;

    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    const assessment = await PriorityAssessment.findOneAndUpdate(
      { _id: req.params.id, hospitalId },
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
