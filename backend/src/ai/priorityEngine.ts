// Mock/Rule-based AI Priority Engine
// This is a demonstration engine for the prototype.
// It can be replaced by a trained ML model.
// DISCLAIMER: This does NOT provide medical diagnosis.

export type PriorityLevel = 'ROUTINE' | 'SOON' | 'HIGH';

export interface PriorityInput {
  symptoms: string[];
  reason: string;
  age?: number;
  gender?: string;
  medicalHistory?: string[];
  urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PriorityResult {
  priority: PriorityLevel;
  confidence: number;
  reason: string;
  factors: string[];
  requiresHumanReview: boolean;
}

const HIGH_URGENCY_KEYWORDS = [
  'chest pain', 'chest tightness', 'heart attack', 'stroke', 'breathing difficulty',
  'shortness of breath', 'severe pain', 'unconscious', 'fainting', 'seizure',
  'allergic reaction', 'anaphylaxis', 'heavy bleeding', 'fracture', 'broken bone',
  'severe headache', 'sudden vision loss', 'paralysis', 'numbness', 'severe vomiting',
  'high fever', 'cannot breathe', 'choking', 'poisoning', 'overdose', 'trauma',
];

const SOON_KEYWORDS = [
  'moderate pain', 'fever', 'cough', 'infection', 'rash', 'swelling',
  'dizziness', 'nausea', 'headache', 'back pain', 'joint pain', 'sore throat',
  'ear pain', 'abdominal pain', 'urinary issues', 'skin problem', 'eye irritation',
  'persistent', 'recurring', 'worsening',
];

const HIGH_RISK_CONDITIONS = [
  'diabetes', 'heart disease', 'hypertension', 'asthma', 'cancer',
  'kidney disease', 'liver disease', 'copd', 'blood pressure', 'cardiac',
];

export function assessPriority(input: PriorityInput): PriorityResult {
  const factors: string[] = [];
  let score = 0;

  const textToAnalyze = [
    input.reason.toLowerCase(),
    ...(input.symptoms || []).map((s) => s.toLowerCase()),
  ].join(' ');

  // Check high urgency keywords
  const highMatches = HIGH_URGENCY_KEYWORDS.filter((kw) => textToAnalyze.includes(kw));
  if (highMatches.length > 0) {
    score += 60;
    factors.push(`Potential high-urgency symptoms detected: ${highMatches.slice(0, 2).join(', ')}`);
  }

  // Check soon keywords
  const soonMatches = SOON_KEYWORDS.filter((kw) => textToAnalyze.includes(kw));
  if (soonMatches.length > 0) {
    score += soonMatches.length * 8;
    factors.push(`Symptoms suggesting earlier review: ${soonMatches.slice(0, 2).join(', ')}`);
  }

  // Age factor
  if (input.age !== undefined) {
    if (input.age < 5 || input.age > 70) {
      score += 15;
      factors.push(input.age < 5 ? 'Paediatric patient (age < 5)' : 'Elderly patient (age > 70)');
    } else if (input.age < 12 || input.age > 60) {
      score += 8;
      factors.push(input.age < 12 ? 'Child patient' : 'Senior patient (age > 60)');
    }
  }

  // Medical history
  if (input.medicalHistory && input.medicalHistory.length > 0) {
    const historyText = input.medicalHistory.join(' ').toLowerCase();
    const riskConditions = HIGH_RISK_CONDITIONS.filter((c) => historyText.includes(c));
    if (riskConditions.length > 0) {
      score += riskConditions.length * 10;
      factors.push(`Pre-existing conditions: ${riskConditions.slice(0, 2).join(', ')}`);
    }
  }

  // Urgency level from patient self-report
  if (input.urgencyLevel === 'HIGH') {
    score += 25;
    factors.push('Patient self-reported high urgency');
  } else if (input.urgencyLevel === 'MEDIUM') {
    score += 10;
    factors.push('Patient self-reported medium urgency');
  }

  // Determine priority and confidence
  let priority: PriorityLevel;
  let confidence: number;
  let reason: string;
  let requiresHumanReview: boolean;

  if (score >= 60) {
    priority = 'HIGH';
    confidence = Math.min(0.95, 0.70 + (score - 60) * 0.005);
    reason = 'The submitted information suggests that earlier clinical review may be appropriate based on the reported symptoms and patient profile.';
    requiresHumanReview = true;
    if (factors.length === 0) factors.push('Multiple risk indicators identified');
  } else if (score >= 25) {
    priority = 'SOON';
    confidence = Math.min(0.88, 0.60 + (score - 25) * 0.007);
    reason = 'The submitted information suggests the patient may benefit from a timely appointment within the near term.';
    requiresHumanReview = true;
    if (factors.length === 0) factors.push('Moderate-level symptoms identified');
  } else {
    priority = 'ROUTINE';
    confidence = Math.min(0.85, 0.65 + score * 0.01);
    reason = 'The submitted information is consistent with a routine appointment. Hospital staff will review before confirmation.';
    requiresHumanReview = false;
    if (factors.length === 0) factors.push('Symptoms appear consistent with routine care');
  }

  return {
    priority,
    confidence: parseFloat(confidence.toFixed(2)),
    reason,
    factors,
    requiresHumanReview,
  };
}
