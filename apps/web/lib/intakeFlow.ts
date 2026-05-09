import type { MissionInput } from '@bifrost/shared';

export type IntakeStep = 'ask_brief' | 'ask_product_name' | 'ask_target' | 'ask_domain_cap' | 'ready';

export interface IntakeState {
  step: IntakeStep;
  brief?: string;
  productName?: string;
  target?: string;
  domainCap?: number;
  history: Array<{ from: 'user' | 'bifrost'; text: string; chips?: string[]; createdAt: string }>;
}

export interface IntakeAdvance {
  state: IntakeState;
  bifrostReply?: string;
  chips?: string[];
}

const NOW = () => new Date().toISOString();

export function initialIntake(): IntakeState {
  return {
    step: 'ask_brief',
    history: [
      {
        from: 'bifrost',
        text:
          "What do you want a Bifrost team to ship? Describe in one or two sentences — I'll line up agents and ask any policy questions before we go on-chain.",
        createdAt: NOW(),
      },
    ],
  };
}

function pushUser(state: IntakeState, text: string): IntakeState {
  return { ...state, history: [...state.history, { from: 'user', text, createdAt: NOW() }] };
}

function pushBifrost(
  state: IntakeState,
  text: string,
  chips?: string[],
): IntakeState {
  return { ...state, history: [...state.history, { from: 'bifrost', text, chips, createdAt: NOW() }] };
}

export function intakeNext(state: IntakeState, userText: string): IntakeAdvance {
  const trimmed = userText.trim();
  if (!trimmed) return { state };

  switch (state.step) {
    case 'ask_brief': {
      const next: IntakeState = {
        ...pushUser(state, trimmed),
        brief: trimmed,
        step: 'ask_product_name',
      };
      const reply = "Got it. What should I call the product? (Pick one or write your own.)";
      const chips = ['RecallReady AI', 'DentalSDR', 'Smile Outreach'];
      return { state: pushBifrost(next, reply, chips), bifrostReply: reply, chips };
    }
    case 'ask_product_name': {
      const next: IntakeState = {
        ...pushUser(state, trimmed),
        productName: trimmed,
        step: 'ask_target',
      };
      const reply = "Who is this for? Pick a target audience or describe yours.";
      const chips = ['Independent dental practices', 'DSO chains', 'Mixed (solo + DSO)'];
      return { state: pushBifrost(next, reply, chips), bifrostReply: reply, chips };
    }
    case 'ask_target': {
      const next: IntakeState = {
        ...pushUser(state, trimmed),
        target: trimmed,
        step: 'ask_domain_cap',
      };
      const reply = "Last question — what's the domain budget cap? Pick one or type a number in USD.";
      const chips = ['$0 — no domain', '$15', '$25', '$50'];
      return { state: pushBifrost(next, reply, chips), bifrostReply: reply, chips };
    }
    case 'ask_domain_cap': {
      const cap = parseDomainCap(trimmed);
      const next: IntakeState = {
        ...pushUser(state, trimmed),
        domainCap: cap,
        step: 'ready',
      };
      const reply =
        "Brief locked. Tap 'Sign brief & launch' to anchor mission on devnet and assemble the team.";
      return { state: pushBifrost(next, reply), bifrostReply: reply };
    }
    case 'ready':
      return { state };
    default:
      return { state };
  }
}

function parseDomainCap(text: string): number {
  const match = text.replace(/[^0-9.]/g, '');
  if (!match) return 0;
  const n = Number(match);
  if (Number.isNaN(n)) return 0;
  return Math.min(200, Math.max(0, n));
}

export function intakeToMissionInput(state: IntakeState, authorityWallet: string): MissionInput {
  const brief = state.brief ?? '';
  const productName = state.productName ?? 'Untitled Launch';
  const target = state.target ?? 'general audience';
  const domainCap = state.domainCap ?? 0;
  const allowDomainPurchase = domainCap > 0;
  return {
    title: `Launch — ${productName}`,
    template: 'launch-site-v1',
    description: brief,
    objective: brief,
    successCriteria: `Live landing page for ${productName} targeted at ${target}.`,
    authorityWallet,
    urgency: 'high',
    executionMode: 'guarded_autonomy',
    verificationMode: 'hybrid',
    maxBudget: 120,
    maxPerCall: 5,
    humanApprovalAbove: 1,
    challengeWindowHours: 24,
    templateConfig: {
      productName,
      oneLineIdea: brief,
      targetAudience: target,
      primaryCTA: 'Join the waitlist',
      brandTone: 'confident, warm, professional',
      mustHaveSections: ['hero', 'how-it-works', 'social-proof', 'faq', 'waitlist'],
      domainBudgetCap: domainCap,
      allowDomainPurchase,
      launchChannels: ['twitter', 'linkedin', 'email'],
    },
  };
}
