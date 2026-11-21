import Papa from 'papaparse';
import { z } from 'zod';

export interface CSVRowError {
  row: number;
  field: string;
  message: string;
}

export interface ValidatedCandidateRow {
  fullName: string;
  phone: string;
  email?: string;
  rollNumber: string;
  score: number;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: CSVRowError[];
  candidates: ValidatedCandidateRow[];
}

const candidateRowSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Phone number must be a valid 10-digit mobile number'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  rollNumber: z.string().trim().min(1, 'Roll number is required'),
  score: z
    .number({ invalid_type_error: 'Score must be a number' })
    .min(0, 'Score cannot be negative')
    .max(100, 'Score cannot exceed 100'),
});

export class CSVService {
  public static parseAndValidate(csvString: string): CSVValidationResult {
    const parseResult = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) =>
        h
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, ''),
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
      return {
        isValid: false,
        errors: parseResult.errors.map((e) => ({
          row: (e.row ?? 0) + 2, // 1-indexed plus header
          field: 'csv_format',
          message: e.message,
        })),
        candidates: [],
      };
    }

    const rows = parseResult.data as Record<string, any>[];
    if (rows.length === 0) {
      return {
        isValid: false,
        errors: [{ row: 1, field: 'file', message: 'CSV file is empty' }],
        candidates: [],
      };
    }

    const errors: CSVRowError[] = [];
    const candidates: ValidatedCandidateRow[] = [];
    const seenRollNumbers = new Map<string, number>();
    const seenPhones = new Map<string, number>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // Row 1 is header

      // Normalize field names
      const fullName = (row.fullname || row.name || row.candidatename || '').trim();
      const phone = (row.phone || row.mobilenumber || row.mobile || '').trim();
      const email = (row.email || row.emailaddress || '').trim();
      const rollNumber = (row.rollnumber || row.rollno || row.candidateid || '').trim();
      const rawScore = (row.score || row.marks || row.percentage || '').trim();
      const parsedScore = rawScore === '' ? NaN : parseFloat(rawScore);

      const parsed = candidateRowSchema.safeParse({
        fullName,
        phone,
        email: email || undefined,
        rollNumber,
        score: parsedScore,
      });

      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({
            row: rowNumber,
            field: issue.path[0]?.toString() || 'row',
            message: issue.message,
          });
        }
      } else {
        // Check for duplicates within this file
        if (seenRollNumbers.has(rollNumber)) {
          errors.push({
            row: rowNumber,
            field: 'rollNumber',
            message: `Duplicate roll number '${rollNumber}' found (already on row ${seenRollNumbers.get(rollNumber)})`,
          });
        } else {
          seenRollNumbers.set(rollNumber, rowNumber);
        }

        if (seenPhones.has(phone)) {
          errors.push({
            row: rowNumber,
            field: 'phone',
            message: `Duplicate phone number '${phone}' found (already on row ${seenPhones.get(phone)})`,
          });
        } else {
          seenPhones.set(phone, rowNumber);
        }

        candidates.push({
          fullName: parsed.data.fullName,
          phone: parsed.data.phone,
          email: parsed.data.email || undefined,
          rollNumber: parsed.data.rollNumber,
          score: parsed.data.score,
        });
      }
    });

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
        candidates: [],
      };
    }

    return {
      isValid: true,
      errors: [],
      candidates,
    };
  }
}
