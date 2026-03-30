/**
 * Patch M38 + M41 synthesis for equitysolarpr.com
 * The scanner picked up the Florida parent "Equity Solar" (St Cloud, FL) instead of
 * the Puerto Rico location at 9 Albolote Ave, Guaynabo, 00969 which has 0 reviews.
 */
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
const SCAN_ID = '16d03ab4-1a57-4586-b4e5-93f548c50691';

async function main() {
  // ─── Step 1: Patch M38 raw data ──────────────────────────────────
  console.log('Patching M38 raw data...');

  const newM38Data = {
    businessProfile: {
      cid: null,
      url: 'https://equitysolarpr.com/',
      phone: null,
      title: 'Equity Solar Puerto Rico',
      address: '9 Albolote Ave, Guaynabo, 00969',
      hasLogo: true,
      placeId: null,
      category: 'Solar energy company',
      avgRating: 0,
      contactUrl: '',
      addressInfo: {
        zip: '00969',
        city: 'Guaynabo',
        region: 'Puerto Rico',
        address: '9 Albolote Ave',
        borough: null,
        country_code: 'PR',
      },
      categoryIds: ['solar_energy_company'],
      description: 'En Equity Solar creemos que cada familia boricua tiene derecho a una energía confiable, accesible y diseñada para resistir el clima de la isla.',
      reviewCount: 0,
      totalPhotos: 0,
      hasMainImage: false,
      hasWorkHours: false,
      bookOnlineUrl: '',
      currentStatus: 'unknown',
      hasPopularTimes: false,
      additionalCategories: null,
    },
    completenessChecklist: [
      { field: 'description', label: 'Business description', present: true },
      { field: 'photos', label: 'Photos (10+)', present: false },
      { field: 'url', label: 'Website URL', present: true },
      { field: 'phone', label: 'Phone number', present: false },
      { field: 'workHours', label: 'Work hours', present: false },
      { field: 'categories', label: 'Multiple categories', present: false },
      { field: 'address', label: 'Full address', present: true },
      { field: 'logo', label: 'Logo', present: true },
      { field: 'rating', label: 'Has reviews', present: false },
      { field: 'bookingUrl', label: 'Booking/contact URL', present: false },
    ],
  };

  const newM38Checkpoints = [
    {
      id: 'm38-presence',
      name: 'GBP Presence',
      health: 'warning',
      weight: 0.3,
      evidence: 'Google Business Profile exists but is severely underdeveloped for Guaynabo, PR location',
    },
    {
      id: 'm38-completeness',
      name: 'Profile Completeness',
      health: 'critical',
      weight: 0.4,
      evidence: '4/10 fields complete. Missing: Phone, Work Hours, Photos, Reviews, Categories, Booking URL',
    },
    {
      id: 'm38-photos',
      name: 'Photo Presence',
      health: 'critical',
      weight: 0.3,
      evidence: '0 photos — no visual presence for local searchers',
    },
  ];

  const { error: m38Err } = await sb.from('module_results').upsert({
    scan_id: SCAN_ID,
    module_id: 'M38',
    status: 'success',
    data: newM38Data,
    checkpoints: newM38Checkpoints,
    signals: [],
  }, { onConflict: 'scan_id,module_id' });

  if (m38Err) { console.error('M38 patch failed:', m38Err.message); process.exit(1); }
  console.log('✅ M38 patched: Guaynabo PR location, 0 reviews');

  // ─── Step 2: Patch M41 synthesis for M38 ─────────────────────────
  console.log('Patching M41 synthesis for M38...');

  const { data: m41Row } = await sb.from('module_results').select('data').eq('scan_id', SCAN_ID).eq('module_id', 'M41').single();
  if (!m41Row) { console.error('M41 not found'); process.exit(1); }

  const m41Data = m41Row.data as Record<string, any>;
  const summaries = m41Data.moduleSummaries as Record<string, any>;

  summaries['M38'] = {
    source: 'ai',
    analysis: `## Local Pack & Google Business Profile Analysis\n\nEquity Solar Puerto Rico's Google Business Profile for the Guaynabo location reveals a critically underdeveloped local search presence. For a solar installation company operating in a market where homeowners rely heavily on local search and trust signals to make high-ticket purchasing decisions, this represents a fundamental failure to capture demand at the moment of highest intent.\n\n### Profile State: A Ghost Listing\nThe GBP at 9 Albolote Ave, Guaynabo, 00969 exists but is functionally dormant. With zero reviews, zero photos, no phone number, and no business hours listed, the profile offers almost nothing to reassure a potential customer. In the solar industry—where projects routinely cost $15,000-$30,000—consumers require overwhelming evidence of credibility before even requesting a quote. A bare GBP with no social proof is the digital equivalent of an empty storefront with no signage.\n\n### The Zero-Review Problem\nThe most critical gap is the complete absence of Google reviews. With 0 reviews and a 0.0 rating, the business cannot appear in Google's Local Pack (the map results) for competitive queries like "instalación solar Puerto Rico" or "placas solares Guaynabo." Google's local algorithm heavily weights review quantity, velocity, and rating—all of which are at zero. This means the business is invisible to the highest-intent local searchers.\n\n### Completeness Score: 40%\nOnly 4 of 10 key profile fields are filled: business description, website URL, address, and logo. Critical missing elements include phone number, business hours, photos, booking URL, and secondary categories. Each missing field reduces the profile's ability to rank and convert.\n\n### Competitive Impact\nIn the Puerto Rico solar market, which has seen explosive growth due to grid instability and federal tax incentives, competitors with even 10-20 reviews and basic profile optimization will systematically outrank and outconvert this listing. The business is effectively ceding the entire local search channel to competitors.`,
    executive_summary: `Equity Solar Puerto Rico's Google Business Profile at 9 Albolote Ave, Guaynabo is critically underdeveloped with zero reviews, zero photos, and only 40% profile completeness. The business is invisible in local search results and cannot compete for high-intent solar installation queries. Immediate investment in profile optimization and review generation is required to establish any meaningful local search presence.`,
    key_findings: [
      {
        finding: 'Zero Google reviews — business is invisible in Local Pack',
        detail: 'Without any reviews, the business cannot appear in Google Maps results for solar-related queries in Puerto Rico. This is the single biggest gap in their local marketing.',
        evidence: 'reviewCount: 0, avgRating: 0',
        severity: 'critical',
        parameter: 'Review Volume',
        business_impact: 'Complete loss of the highest-intent local search channel. Prospects searching for solar installers in Guaynabo will never see this business.',
        recommendation: {
          action: 'Launch a review generation campaign targeting existing customers immediately.',
          effort: 'M',
          priority: 'P0',
          expected_impact: 'Establish initial review baseline of 10-15 reviews to become visible in Local Pack.',
          implementation_steps: [
            'Identify the last 30-50 completed installations',
            'Send personalized SMS/WhatsApp with direct Google review link',
            'Train installation crews to request reviews at project completion',
            'Set up automated post-installation review request via CRM',
          ],
        },
      },
      {
        finding: 'Only 40% profile completeness — missing critical conversion fields',
        detail: 'Phone number, business hours, photos, booking URL, and secondary categories are all missing. Each gap reduces both ranking potential and conversion rate.',
        evidence: '4/10 fields complete',
        severity: 'critical',
        parameter: 'Profile Completeness',
        business_impact: 'Lower ranking signals and poor user experience for prospects who do find the listing.',
        recommendation: {
          action: 'Complete all GBP fields within 48 hours.',
          effort: 'S',
          priority: 'P0',
          expected_impact: 'Immediate improvement in profile quality signals sent to Google.',
          implementation_steps: [
            'Add business phone number and hours',
            'Upload 20+ photos of installations, team, and office',
            'Add secondary categories: Solar energy contractor, Solar panel installer',
            'Add booking/contact URL',
          ],
        },
      },
      {
        finding: 'Zero photos uploaded to Google Business Profile',
        detail: 'Photos are a top-tier engagement signal. Businesses with 100+ photos receive 520% more calls than those without. This profile has none.',
        evidence: 'totalPhotos: 0',
        severity: 'critical',
        parameter: 'Visual Content',
        business_impact: 'Dramatically lower engagement and trust compared to competitors with visual proof of their work.',
        recommendation: {
          action: 'Upload installation portfolio photos to GBP.',
          effort: 'S',
          priority: 'P1',
          expected_impact: 'Increased calls, clicks, and direction requests from local searchers.',
          implementation_steps: [
            'Photograph 10-15 completed installations (before/after)',
            'Include team photos and office/warehouse shots',
            'Upload as GBP photos with descriptive captions',
            'Continue adding 5+ new photos monthly',
          ],
        },
      },
    ],
    module_score: 12,
    recommendations: [
      {
        action: 'Deploy Automated Review Generation System',
        effort: 'M',
        priority: 'P0',
        expected_impact: 'Build review momentum to reach 20+ reviews within 60 days.',
        implementation_steps: [
          'Select a reputation management tool (NiceJob, Grade.us, or Podium)',
          'Integrate with existing CRM/project management workflow',
          'Set automated triggers at installation completion milestones',
          'Monitor weekly velocity and respond to all reviews within 24 hours',
        ],
      },
      {
        action: 'Complete Google Business Profile Optimization',
        effort: 'S',
        priority: 'P0',
        expected_impact: 'Immediate improvement in local ranking factors and user trust.',
        implementation_steps: [
          'Fill all 10 profile fields (phone, hours, photos, categories, booking URL)',
          'Write a keyword-rich business description mentioning Guaynabo and Puerto Rico',
          'Add Q&A section with common solar installation questions',
          'Enable messaging for direct customer inquiries',
        ],
      },
    ],
    score_breakdown: [
      {
        criterion: 'Profile Completeness',
        score: 20,
        weight: 0.3,
        evidence: '4/10 fields present; missing phone, hours, photos, categories, booking URL, reviews',
      },
      {
        criterion: 'Visual Content',
        score: 0,
        weight: 0.2,
        evidence: '0 photos uploaded',
      },
      {
        criterion: 'Reputation Management',
        score: 0,
        weight: 0.3,
        evidence: '0 reviews, 0.0 rating — no social proof whatsoever',
      },
      {
        criterion: 'Conversion Optimization',
        score: 25,
        weight: 0.2,
        evidence: 'Website URL present but no phone, booking link, or hours to facilitate conversion',
      },
    ],
    score_rationale: 'The score of 12 reflects a Google Business Profile that exists in name only. With zero reviews, zero photos, and critical missing fields, the listing provides almost no value for local search visibility or customer conversion. The business is effectively invisible to local searchers in the Guaynabo/PR market.',
  };

  const { error: m41Err } = await sb.from('module_results').update({ data: m41Data }).eq('scan_id', SCAN_ID).eq('module_id', 'M41');
  if (m41Err) { console.error('M41 patch failed:', m41Err.message); process.exit(1); }
  console.log('✅ M41 synthesis for M38 patched: 0 reviews, 12 score, Guaynabo PR');

  console.log('\nDone. Slide 30 will now show correct PR location data.');
}

main().catch(err => { console.error(err); process.exit(1); });
