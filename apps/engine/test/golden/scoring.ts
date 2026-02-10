export interface QualityScore {
  accuracy: number; // 0-100
  specificity: number; // 0-100
  actionability: number; // 0-100
  hallucination: number; // 0-100 (100 = no hallucinations)
  overall: number; // Weighted average
}

export function scoreOutput(
  aiOutput: any,
  groundTruth: any,
  _moduleOutputs: any,
): QualityScore {
  const accuracy = scoreAccuracy(aiOutput, groundTruth);
  const specificity = scoreSpecificity(aiOutput);
  const actionability = scoreActionability(aiOutput);
  const hallucination = 100; // Placeholder — needs manual verification

  return {
    accuracy,
    specificity,
    actionability,
    hallucination,
    overall:
      accuracy * 0.4 + specificity * 0.25 + actionability * 0.25 + hallucination * 0.1,
  };
}

function scoreAccuracy(aiOutput: any, groundTruth: any): number {
  const expected = new Set(
    (groundTruth.knownTechnologies as string[]).map((t: string) => t.toLowerCase()),
  );
  if (expected.size === 0) return 100;

  const outputString = JSON.stringify(aiOutput).toLowerCase();
  let hits = 0;
  for (const tech of expected) {
    if (outputString.includes(tech)) hits++;
  }
  return Math.round((hits / expected.size) * 100);
}

function scoreSpecificity(aiOutput: any): number {
  const text = JSON.stringify(aiOutput);

  const markers = [
    /G-[A-Z0-9]{7,10}/g, // GA4 measurement IDs
    /GTM-[A-Z0-9]{6,8}/g, // GTM container IDs
    /UA-\d{6,10}-\d/g, // Universal Analytics IDs
    /\d+\.\d+\.\d+/g, // Version numbers
    /https?:\/\/[^\s"]+/g, // URLs
    /_ga|_gid|_fbp|_fbc|hubspotutk/g, // Cookie names
  ];

  let evidenceCount = 0;
  for (const pattern of markers) {
    const matches = text.match(pattern);
    evidenceCount += matches?.length || 0;
  }

  return Math.min(100, Math.round((evidenceCount / 20) * 100));
}

function scoreActionability(aiOutput: any): number {
  const text = JSON.stringify(aiOutput);

  const actionPatterns = [
    /implement/gi,
    /configure/gi,
    /migrate/gi,
    /add\s/gi,
    /remove\s/gi,
    /upgrade/gi,
    /enable/gi,
    /set up/gi,
    /switch to/gi,
    /consider\s(using|adding|implementing)/gi,
  ];

  let actionCount = 0;
  for (const pattern of actionPatterns) {
    const matches = text.match(pattern);
    actionCount += matches?.length || 0;
  }

  return Math.min(100, Math.round((actionCount / 15) * 100));
}
