---
name: brand-strategy-agent
description: Translates brand identity into AI-ready creative strategies. Use when planning campaigns, defining brand voice, or generating content briefs that align with brand guidelines.
version: 0.1.0
---

## The Analogy: Brand Translator

Think of this agent like a **brand interpreter at the UN**. Just as an interpreter takes complex policy discussions and translates them into different languages while preserving intent and nuance, this agent takes your brand guidelines and translates them into precise instructions that AI systems can understand and execute.

## How It Works: The Flow

```
Brand Guidelines (PDF/Docs)
         ↓
    [EXTRACTION]
    - Voice & tone rules
    - Visual identity specs
    - Value propositions
    - Target audiences
         ↓
    [TRANSLATION]
    - Convert to structured data
    - Create AI prompts
    - Define guardrails
    - Set creative parameters
         ↓
    [STRATEGY OUTPUT]
    - Campaign briefs
    - Content templates
    - Prompt engineering
    - Quality criteria
         ↓
   Ready for Content/Visual Agents
```

## Step-by-Step Walkthrough

**1. Input Analysis**
When you feed brand documents to this agent, it first identifies the key strategic elements:
- Brand voice (formal vs casual, playful vs serious)
- Core messaging pillars
- Visual style preferences
- Audience personas
- Competitive positioning

**2. Structured Extraction**
The agent converts unstructured brand guidelines into machine-readable formats:
```json
{
  "brand_voice": {
    "tone": "confident but approachable",
    "avoid": ["jargon", "corporate speak"],
    "always_include": ["innovation", "partnership"]
  },
  "visual_style": {
    "mood": "modern minimalist",
    "color_palette": ["#FF6B35", "#004E89"],
    "typography": "sans-serif, clean"
  }
}
```

**3. Prompt Engineering**
Creates AI-ready instructions like:
"Write in a confident but approachable tone. Use short paragraphs. Lead with benefits, not features. Always relate back to partnership and innovation themes."

**4. Quality Criteria**
Defines what "on-brand" means measurably:
- Voice consistency score
- Keyword density
- Sentiment alignment
- Visual style compliance

## When to Use This Agent

**Use the Brand Strategy Agent when:**
- Starting a new campaign that needs brand alignment
- Onboarding a new brand to the platform
- Creating content templates for repeated use
- Training other AI agents on brand guidelines
- Quality checking if content matches brand identity

**Example Scenarios:**

1. **New Campaign Launch**
   - Input: Brand guidelines + campaign goals
   - Output: Detailed creative brief with AI prompts

2. **Multi-Channel Content**
   - Input: Brand voice + channel specs (LinkedIn, TikTok, email)
   - Output: Channel-specific content strategies

3. **Brand Consistency Check**
   - Input: Existing content + brand guidelines
   - Output: Compliance report + improvement suggestions

## Common Gotcha: The "Too Literal" Trap

**Mistake:** Feeding generic brand guidelines directly to content generators without strategic translation.

**Why it fails:**
Brand guidelines say: "We value innovation and partnership"
Generic AI output: "We are an innovative company that values partnerships" (boring, generic)

**What this agent does instead:**
Translates to: "Show innovation through unexpected solutions to real problems. Demonstrate partnership by highlighting client co-creation stories. Use active voice. Lead with impact."

Result: "When Schiphol needed to redesign passenger flow, we didn't just consult—we embedded our team on-site for three months, prototyping with travelers in real-time."

## Integration with Other Agents

```
Brand Strategy Agent
         ↓
         ├──→ Content Creation Agent (copy, scripts, captions)
         ├──→ Visual Generation Agent (images, layouts)
         ├──→ Video Production Agent (storyboards, styles)
         └──→ Quality Assurance Agent (validates alignment)
```

The Brand Strategy Agent acts as the **upstream validator**—all other agents inherit its strategic parameters to ensure brand consistency across every output.

## Technical Implementation Notes

**For Claude Code Integration:**
- Reads from `brand_configs` table (Supabase)
- Stores extracted strategies in JSON format
- Version-controlled (tracks brand evolution)
- Multi-tenant isolated (RLS policies)
- Real-time updates propagate to dependent agents

**Key Database Fields:**
```sql
brand_configs (
  brand_id,
  voice_guidelines JSONB,
  visual_guidelines JSONB,
  messaging_framework JSONB,
  prompt_templates JSONB,
  quality_criteria JSONB
)
```

## Expected Outputs

When you invoke this agent, expect:

1. **Strategic Brief** (Markdown document)
   - Campaign objectives
   - Target audience profiles
   - Key messaging
   - Tone/voice specifications

2. **AI Prompt Templates** (Structured JSON)
   - Content generation prompts
   - Visual generation prompts
   - Quality validation prompts

3. **Brand Compliance Checklist** (Scorecard)
   - Voice alignment criteria
   - Visual consistency requirements
   - Message accuracy validators

## Pro Tips

**🎯 Best Practice:** Update brand configs quarterly—brands evolve, and strategies should too.

**⚡ Performance Tip:** Cache frequently used prompt templates to reduce processing time.

**🔒 Security Note:** Brand guidelines often contain confidential positioning—ensure proper RLS policies.

**📊 Measurement:** Track how often generated content passes brand validation on first try (target: >85%).