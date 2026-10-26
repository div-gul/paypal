import { z } from 'zod';
import { StoreProduct, WeeklySchedulerConfig } from '@shared/types';
import { AppError } from '../../middleware/errorHandler.js';

export const PolicyProposalSchema = z.object({
  preferredShoppingDay: z.number().int().min(0).max(6).optional(),
  shoppingFrequency: z.enum(['weekly', 'biweekly']).optional(),
  emergencyRestockPreference: z.enum(['auto_order', 'ask_approval', 'alert_only']).optional(),
  urgentThresholdDays: z.number().min(1).max(14).optional(),
  perCycleBudgetPaise: z.number().int().nonnegative().optional(),
  perOrderCapPaise: z.number().int().nonnegative().optional(),
  requireApprovalBrandSubstitution: z.boolean().optional(),
  blockedCategories: z.array(z.string()).optional(),
  explanation: z.string(),
  changesSummary: z.array(z.string()),
});

export type PolicyProposal = z.infer<typeof PolicyProposalSchema>;

export const SubstituteResultSchema = z.object({
  selectedProductId: z.string(),
  productName: z.string(),
  brand: z.string(),
  pricePaise: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type SubstituteResult = z.infer<typeof SubstituteResultSchema>;

export class LLMService {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LLM_API_KEY;
  }

  /**
   * Parse plain English restock instructions into structured policy proposals.
   * NOTE: The output is strictly a proposal — caller must confirm before saving.
   */
  async parsePolicy(prompt: string, currentPolicy: WeeklySchedulerConfig): Promise<PolicyProposal> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw new AppError('INVALID_PROMPT', 'Prompt cannot be empty', 400);
    }

    if (this.apiKey && this.apiKey !== 'mock') {
      try {
        return await this.callExternalLLMPolicyParser(trimmed, currentPolicy);
      } catch (err: any) {
        console.warn(`[LLMService] External LLM call failed (${err.message}). Falling back to deterministic NLP parser.`);
      }
    }

    // Deterministic Rule-Based Fallback Parser (Robust & Fast)
    return this.deterministicPolicyParser(trimmed, currentPolicy);
  }

  /**
   * Select best alternative item strictly from a server-provided candidate list.
   * Hallucinated product IDs are rejected.
   */
  async selectSubstitute(params: {
    pantryItemId: string;
    itemName: string;
    preferredBrand: string;
    reason?: string;
    candidates: StoreProduct[];
  }): Promise<SubstituteResult> {
    const { pantryItemId, itemName, preferredBrand, candidates, reason } = params;

    if (!candidates || candidates.length === 0) {
      throw new AppError('NO_CANDIDATES', 'Candidate list cannot be empty for substitution', 400);
    }

    // Filter to in-stock candidates only
    const validCandidates = candidates.filter(c => c.inStock);
    if (validCandidates.length === 0) {
      throw new AppError('OUT_OF_STOCK', 'No in-stock candidates available for substitution', 400);
    }

    let selected: SubstituteResult;

    if (this.apiKey && this.apiKey !== 'mock') {
      try {
        selected = await this.callExternalLLMSubstitute(itemName, preferredBrand, validCandidates, reason);
      } catch (err: any) {
        console.warn(`[LLMService] External LLM substitute failed (${err.message}). Falling back to heuristic substitution.`);
        selected = this.deterministicSubstitute(preferredBrand, validCandidates);
      }
    } else {
      selected = this.deterministicSubstitute(preferredBrand, validCandidates);
    }

    // Strict validation: Verify the chosen product ID actually exists in server-provided candidates!
    const candidateMatch = validCandidates.find(c => c.id === selected.selectedProductId);
    if (!candidateMatch) {
      console.warn(`[LLMService] LLM proposed hallucinated product ID "${selected.selectedProductId}". Falling back to top candidate.`);
      const top = validCandidates[0];
      return {
        selectedProductId: top.id,
        productName: top.name,
        brand: top.brand,
        pricePaise: top.pricePaise,
        confidence: 0.85,
        reasoning: `Server fallback: Selected closest in-stock match "${top.name}" (${top.brand}) to replace unavailable item.`,
      };
    }

    return selected;
  }

  /**
   * Deterministic natural language policy extractor
   */
  private deterministicPolicyParser(prompt: string, current: WeeklySchedulerConfig): PolicyProposal {
    const lower = prompt.toLowerCase();
    const changesSummary: string[] = [];
    const proposal: Partial<WeeklySchedulerConfig> = {};

    // 1. Budget Cap extraction (e.g. "budget of ₹3000", "limit to 2500 rupees", "budget 2000")
    const budgetMatch = lower.match(/(?:budget|cycle|limit|spend)\s*(?:of|to|is)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (budgetMatch) {
      const amount = parseFloat(budgetMatch[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) {
        proposal.perCycleBudgetPaise = Math.round(amount * 100);
        changesSummary.push(`Set weekly budget cap to ₹${amount.toLocaleString('en-IN')}`);
      }
    }

    // 2. Per-order cap extraction (e.g. "per-order cap 1500", "max 1000 per order", "per order 800")
    const perOrderMatch = lower.match(/(?:per\s*order|single\s*order|max\s*order)\s*(?:cap|limit|max)?\s*(?:of|to|is)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (perOrderMatch) {
      const amount = parseFloat(perOrderMatch[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) {
        proposal.perOrderCapPaise = Math.round(amount * 100);
        changesSummary.push(`Set per-order spending cap to ₹${amount.toLocaleString('en-IN')}`);
      }
    }

    // 3. Preferred shopping day (e.g. "shop on fridays", "shopping day tuesday")
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (lower.includes(days[i])) {
        proposal.preferredShoppingDay = i;
        changesSummary.push(`Change regular restocking day to ${days[i].charAt(0).toUpperCase() + days[i].slice(1)}`);
        break;
      }
    }

    // 4. Shopping frequency (e.g. "shop biweekly", "weekly schedule")
    if (lower.includes('biweekly') || lower.includes('every two weeks') || lower.includes('fortnightly')) {
      proposal.shoppingFrequency = 'biweekly';
      changesSummary.push('Update shopping frequency to biweekly');
    } else if (lower.includes('weekly') || lower.includes('once a week')) {
      proposal.shoppingFrequency = 'weekly';
      changesSummary.push('Update shopping frequency to weekly');
    }

    // 5. Emergency preference (e.g. "never order automatically", "auto order emergency", "just alert me")
    if (lower.includes('never order') || lower.includes('alert only') || lower.includes('only alert') || lower.includes('just alert')) {
      proposal.emergencyRestockPreference = 'alert_only';
      changesSummary.push('Set emergency restock preference to alert only (no auto-purchases)');
    } else if (lower.includes('auto order') || lower.includes('automatically order') || lower.includes('auto restock')) {
      proposal.emergencyRestockPreference = 'auto_order';
      changesSummary.push('Enable automatic emergency restocking without manual approval');
    } else if (lower.includes('ask me') || lower.includes('ask approval') || lower.includes('require approval for emergency')) {
      proposal.emergencyRestockPreference = 'ask_approval';
      changesSummary.push('Require manual approval for off-cycle emergency restocking');
    }

    // 6. Brand substitution rule (e.g. "always ask before substituting", "allow any brand")
    if (lower.includes('always ask') && lower.includes('brand')) {
      proposal.requireApprovalBrandSubstitution = true;
      changesSummary.push('Require approval before substituting any brand');
    } else if (lower.includes('allow brand substitution') || lower.includes('trust brand')) {
      proposal.requireApprovalBrandSubstitution = false;
      changesSummary.push('Allow automatic brand substitutions');
    }

    // 7. Category blocks (e.g. "block snacks", "stop buying alcohol", "don't buy meat")
    const blockedCategories = current.blockedCategories ? [...current.blockedCategories] : [];
    const blockPatterns = [
      { pattern: /(?:block|stop buying|don't buy|avoid)\s*(?:any\s*)?(snacks|junk food)/i, cat: 'Snacks' },
      { pattern: /(?:block|stop buying|don't buy|avoid)\s*(?:any\s*)?(dairy|milk products)/i, cat: 'Dairy' },
      { pattern: /(?:block|stop buying|don't buy|avoid)\s*(?:any\s*)?(beverages|drinks|soda)/i, cat: 'Beverages' },
      { pattern: /(?:block|stop buying|don't buy|avoid)\s*(?:any\s*)?(personal care|cosmetics)/i, cat: 'Personal Care' },
    ];

    for (const b of blockPatterns) {
      if (b.pattern.test(lower) && !blockedCategories.includes(b.cat)) {
        blockedCategories.push(b.cat);
        proposal.blockedCategories = blockedCategories;
        changesSummary.push(`Added "${b.cat}" to blocked restock categories`);
      }
    }

    if (changesSummary.length === 0) {
      return {
        ...proposal,
        explanation: 'We could not detect any specific policy changes from your instruction. Please specify target budget caps (e.g., "Set budget to ₹3000"), shopping days, or restrictions.',
        changesSummary: [],
      };
    }

    return {
      ...proposal,
      explanation: `Parsed restock policy adjustments from your instructions: ${changesSummary.join(', ')}.`,
      changesSummary,
    };
  }

  /**
   * Deterministic heuristic substitute selection
   */
  private deterministicSubstitute(preferredBrand: string, candidates: StoreProduct[]): SubstituteResult {
    // 1. Prefer exact brand match if in stock
    const exact = candidates.find(c => c.brand.toLowerCase() === preferredBrand.toLowerCase());
    if (exact) {
      return {
        selectedProductId: exact.id,
        productName: exact.name,
        brand: exact.brand,
        pricePaise: exact.pricePaise,
        confidence: 0.98,
        reasoning: `Found exact brand match "${exact.brand}" from ${exact.storeId.toUpperCase()} in stock.`,
      };
    }

    // 2. Sort by price
    const sorted = [...candidates].sort((a, b) => a.pricePaise - b.pricePaise);
    const chosen = sorted[0];

    return {
      selectedProductId: chosen.id,
      productName: chosen.name,
      brand: chosen.brand,
      pricePaise: chosen.pricePaise,
      confidence: 0.88,
      reasoning: `Preferred brand "${preferredBrand}" was unavailable. Selected closest premium substitute "${chosen.name}" (${chosen.brand}) offering the best value.`,
    };
  }

  private async callExternalLLMPolicyParser(
    _prompt: string,
    _current: WeeklySchedulerConfig
  ): Promise<PolicyProposal> {
    // If configured with a live OpenAI/Gemini endpoint, make request here with timeout
    throw new Error('External LLM integration not configured');
  }

  private async callExternalLLMSubstitute(
    _itemName: string,
    _preferredBrand: string,
    _candidates: StoreProduct[],
    _reason?: string
  ): Promise<SubstituteResult> {
    // If configured with a live OpenAI/Gemini endpoint, make request here with timeout
    throw new Error('External LLM integration not configured');
  }
}
