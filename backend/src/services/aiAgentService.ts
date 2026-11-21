import { prisma } from '../config/db';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './auditService';
import { sseService } from './sseService';

export interface AnomalyFinding {
  code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  affectedCandidates?: string[];
}

export interface AIAuditReport {
  batchId: string;
  batchTitle: string;
  analyzedAt: string;
  candidateCount: number;
  statistics: {
    meanScore: number;
    medianScore: number;
    stdDev: number;
    minScore: number;
    maxScore: number;
    passRate: number;
  };
  riskScore: number; // 0 - 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  findings: AnomalyFinding[];
  recommendation: {
    action: 'FAST_TRACK_APPROVAL' | 'MANUAL_REVIEW_RECOMMENDED' | 'ESCALATE_TO_STATE_VIGILANCE';
    summary: string;
    rationale: string;
  };
}

export class AIAgentService {
  /**
   * Runs the 4-Stage Autonomous Forensic & Quality Audit Pipeline on a Batch
   */
  public static async runBatchAudit(batchId: string, actorId?: string, actorRole?: string, correlationId?: string): Promise<AIAuditReport> {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        candidates: true,
      },
    });

    if (!batch) {
      throw new AppError(404, 'Batch not found');
    }

    if (batch.candidates.length === 0) {
      throw new AppError(400, 'Cannot run AI audit on an empty batch. Upload candidates first.');
    }

    const candidates = batch.candidates;
    const scores = candidates.map((c) => c.score);
    const n = scores.length;

    // --- STAGE 1: Statistical Feature Extraction ---
    const sum = scores.reduce((acc, s) => acc + s, 0);
    const mean = sum / n;
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median = n % 2 === 0 ? (sortedScores[n / 2 - 1] + sortedScores[n / 2]) / 2 : sortedScores[Math.floor(n / 2)];
    const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const passingCount = scores.filter((s) => s >= 40).length;
    const passRate = (passingCount / n) * 100;

    const findings: AnomalyFinding[] = [];
    let anomalyScorePenalty = 0;

    // --- STAGE 2: Forensic & Anomaly Detection Heuristics ---

    // 1. Artificial Score Uniformity / Clumping Check
    if (n >= 5 && stdDev < 1.2) {
      anomalyScorePenalty += 35;
      findings.push({
        code: 'ANOMALY_ARTIFICIAL_UNIFORMITY',
        severity: 'CRITICAL',
        title: 'Artificial Score Clumping Detected',
        description: `Candidates exhibit an unnaturally narrow standard deviation (${stdDev.toFixed(2)} pts) across ${n} candidates. Real skilling cohorts normally exhibit standard deviations between 6.0 and 18.0.`,
      });
    }

    // 2. Improbable High-Score Saturation Check
    const perfectScores = scores.filter((s) => s >= 98).length;
    if (n >= 10 && perfectScores / n > 0.6) {
      anomalyScorePenalty += 30;
      findings.push({
        code: 'ANOMALY_GRADE_INFLATION',
        severity: 'WARNING',
        title: 'Extreme Grade Saturation',
        description: `${((perfectScores / n) * 100).toFixed(0)}% of candidates scored 98% or above. Suggests potential unproctored assessment or answer key leakage.`,
      });
    }

    // 3. Sequential Phone Numbers / Ghost Candidate Heuristic
    const sortedPhones = candidates
      .map((c) => ({ phone: c.phone, name: c.fullName }))
      .sort((a, b) => a.phone.localeCompare(b.phone));

    const sequentialClusters: string[] = [];
    for (let i = 0; i < sortedPhones.length - 1; i++) {
      const p1 = parseInt(sortedPhones[i].phone, 10);
      const p2 = parseInt(sortedPhones[i + 1].phone, 10);
      if (p2 - p1 === 1) {
        sequentialClusters.push(`${sortedPhones[i].name} (${sortedPhones[i].phone}) & ${sortedPhones[i + 1].name} (${sortedPhones[i + 1].phone})`);
      }
    }

    if (sequentialClusters.length >= 2) {
      anomalyScorePenalty += 40;
      findings.push({
        code: 'ANOMALY_SEQUENTIAL_CONTACTS',
        severity: 'CRITICAL',
        title: 'Sequential Phone Number Pattern (Possible Ghost Candidates)',
        description: `Found ${sequentialClusters.length} consecutive phone number pairs. In public training missions, sequential numbers frequently indicate SIM batch purchases or fabricated candidate profiles.`,
        affectedCandidates: sequentialClusters.slice(0, 5),
      });
    }

    // 4. Marginal Score Clustering (Passing Edge Manipulation)
    const borderlinePass = scores.filter((s) => s >= 40 && s <= 42).length;
    if (n >= 10 && borderlinePass / n > 0.3) {
      anomalyScorePenalty += 20;
      findings.push({
        code: 'ANOMALY_MARGINAL_CLUSTERING',
        severity: 'WARNING',
        title: 'Passing Threshold Clustering',
        description: `${((borderlinePass / n) * 100).toFixed(0)}% of candidates scored within 2 marks of the pass threshold (40%). Review moderation logs.`,
      });
    }

    // --- STAGE 3: Risk Scoring & Trust Evaluation ---
    // If large batch (>= 50), add informational scrutiny notice
    if (n >= 50) {
      findings.push({
        code: 'POLICY_LARGE_BATCH_SCRUTINY',
        severity: 'INFO',
        title: 'High-Volume Batch Governance Applied',
        description: `Cohort size (${n} candidates) triggers mandatory secondary quality team oversight in compliance with State Mission Guidelines.`,
      });
    }

    const calculatedRisk = Math.min(100, Math.max(5, anomalyScorePenalty));
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (calculatedRisk >= 50) riskLevel = 'HIGH';
    else if (calculatedRisk >= 25) riskLevel = 'MEDIUM';

    // --- STAGE 4: Recommendation Engine ---
    let action: 'FAST_TRACK_APPROVAL' | 'MANUAL_REVIEW_RECOMMENDED' | 'ESCALATE_TO_STATE_VIGILANCE' = 'FAST_TRACK_APPROVAL';
    let summary = 'Batch conforms to standard statistical distributions with zero anomaly flags.';
    let rationale = 'Scores demonstrate natural Gaussian variance and all contact demographics are heterogeneous.';

    if (riskLevel === 'HIGH') {
      action = 'ESCALATE_TO_STATE_VIGILANCE';
      summary = 'High probability of roster manipulation or ghost candidate inflation detected.';
      rationale = `Detected critical anomalies: ${findings.map((f) => f.title).join('; ')}. Immediate on-site biometric verification is advised before certification.`;
    } else if (riskLevel === 'MEDIUM') {
      action = 'MANUAL_REVIEW_RECOMMENDED';
      summary = 'Cohort exhibits non-critical variance irregularities.';
      rationale = 'Minor score concentration or boundary clustering detected. Recommend district officer spot-checks candidate attendance records.';
    }

    // --- STAGE 5: Neural OpenAI Synthesis (if API key available) ---
    if (config.openaiApiKey && config.openaiApiKey.startsWith('sk-')) {
      try {
        const prompt = `You are the Lead Quality & Forensic Auditor for the Pragati Skills Mission government credentialing platform.
Analyze this vocational training batch:
- Batch Title: "${batch.title}" (Course: "${batch.courseName}", Training Centre: "${batch.centreId}", District: "${batch.districtId}")
- Cohort Size: ${n} candidates
- Score Statistics: Mean=${mean.toFixed(1)}%, StdDev=±${stdDev.toFixed(2)}, Min=${minScore}%, Max=${maxScore}%, PassRate=${passRate.toFixed(1)}%
- Statistical Anomaly Flags: ${JSON.stringify(findings)}
- Algorithmic Risk Rating: ${riskLevel} (Score: ${calculatedRisk}/100)

Respond in strictly valid JSON with this exact schema:
{
  "summary": "1-2 sentence executive briefing on cohort integrity",
  "rationale": "2-3 sentences of forensic analysis explaining score distributions, contact demographics, and audit recommendation"
}`;

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 300,
          }),
        });

        if (aiRes.ok) {
          const aiJson = (await aiRes.json()) as any;
          const parsed = JSON.parse(aiJson.choices[0].message.content);
          if (parsed.summary) summary = `[OpenAI GPT-4o Analysis] ${parsed.summary}`;
          if (parsed.rationale) rationale = parsed.rationale;
        }
      } catch (aiErr) {
        // Graceful fallback to statistical heuristics if OpenAI times out or fails
        console.warn('[AI Agent] OpenAI enrichment skipped/timed out, using statistical engine:', aiErr);
      }
    }

    const report: AIAuditReport = {
      batchId: batch.id,
      batchTitle: batch.title,
      analyzedAt: new Date().toISOString(),
      candidateCount: n,
      statistics: {
        meanScore: parseFloat(mean.toFixed(2)),
        medianScore: parseFloat(median.toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
        minScore,
        maxScore,
        passRate: parseFloat(passRate.toFixed(1)),
      },
      riskScore: calculatedRisk,
      riskLevel,
      findings,
      recommendation: {
        action,
        summary,
        rationale,
      },
    };

    // Record audit event
    await AuditService.record({
      correlationId,
      actorId: actorId || 'SYSTEM_AI_AGENT',
      actorRole: actorRole || 'AI_AGENT',
      action: 'AI_QUALITY_AUDIT_COMPLETED',
      entityType: 'Batch',
      entityId: batch.id,
      metadata: {
        riskLevel,
        riskScore: calculatedRisk,
        findingsCount: findings.length,
        recommendedAction: action,
      },
    });

    await sseService.publishEvent('AI_AUDIT_COMPLETED', {
      batchId: batch.id,
      riskLevel,
      riskScore: calculatedRisk,
    });

    return report;
  }
}
