"""Nexa niche modes — tailored workflows per vertical (PDF slide 1)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class NicheMode:
    id: str
    label: str
    emoji: str
    tagline: str
    workflows: tuple[str, ...]
    sample_outcomes: tuple[str, ...]
    business_ideas: tuple[str, ...]


NICHES: dict[str, NicheMode] = {
    "agency": NicheMode(
        id="agency",
        label="Agency",
        emoji="🏢",
        tagline="Client acquisition, retainers, and delivery on autopilot",
        workflows=(
            "Audit pipeline and propose 3 upsell offers for existing clients",
            "Draft outreach sequence for 20 qualified prospects",
            "Post weekly client wins to Slack",
            "Log campaign performance snapshot in Notion",
            "Trigger lead-gen workflow in n8n",
        ),
        sample_outcomes=(
            "Get me 10 agency clients this month",
            "Increase retainer revenue by 20%",
            "Automate client reporting",
        ),
        business_ideas=(
            "Performance marketing agency for local restaurants",
            "UGC content studio for DTC brands",
            "LinkedIn ghostwriting agency for founders",
            "Shopify CRO agency for fashion stores",
            "AI automation agency for law firms",
        ),
    ),
    "coach": NicheMode(
        id="coach",
        label="Coach / Consultant",
        emoji="🎯",
        tagline="Fill your calendar, nurture leads, deliver transformations",
        workflows=(
            "Draft 5-day nurture email for cold leads",
            "Post discovery-call availability to Calendar",
            "Summarize funnel metrics and next actions",
            "Create client success checklist in Notion",
            "Notify community on Slack about new cohort",
        ),
        sample_outcomes=(
            "Book 15 discovery calls this week",
            "Launch a $2k group program",
            "Grow my email list to 500",
        ),
        business_ideas=(
            "Executive leadership coach for tech managers",
            "Fitness accountability coach via WhatsApp",
            "Career transition coach for nurses",
            "Mindset coach for first-time founders",
            "Sales coaching for B2B SaaS reps",
        ),
    ),
    "ecommerce": NicheMode(
        id="ecommerce",
        label="E-commerce",
        emoji="🛒",
        tagline="Traffic, conversion, retention — executed daily",
        workflows=(
            "Pull revenue and AOV from Stripe",
            "Audit ad spend efficiency on Meta",
            "Draft abandoned-cart recovery email",
            "Post daily sales pulse to Slack",
            "Trigger replenishment workflow in n8n",
        ),
        sample_outcomes=(
            "Get me 50 sales this week",
            "Reduce cart abandonment by 15%",
            "Launch a flash sale campaign",
        ),
        business_ideas=(
            "Curated skincare subscription box UK",
            "Print-on-demand pet accessories store",
            "Eco-friendly home goods on Shopify",
            "Niche supplement brand for gamers",
            "Vintage streetwear dropship brand",
        ),
    ),
    "real_estate": NicheMode(
        id="real_estate",
        label="Real Estate",
        emoji="🏠",
        tagline="Listings, leads, and follow-ups without the admin",
        workflows=(
            "Draft listing description for new property",
            "Schedule buyer viewing blocks on Calendar",
            "Log hot leads from HubSpot CRM",
            "Email market update to warm buyers",
            "Post new listing alert to Slack",
        ),
        sample_outcomes=(
            "Get me 30 buyer leads this month",
            "Fill 4 viewings this week",
            "Launch listing campaign for 2-bed flat",
        ),
        business_ideas=(
            "Luxury rental concierge in Dubai Marina",
            "Student housing agency near universities",
            "Commercial brokerage for warehouses",
            "Property management for Airbnb hosts",
            "Off-plan investment advisory for expats",
        ),
    ),
    "general": NicheMode(
        id="general",
        label="General Business",
        emoji="⚡",
        tagline="Revenue, ops, and growth for any company",
        workflows=(
            "Check live revenue and customer count",
            "Post daily priorities to Slack",
            "Log strategy update in Notion",
            "Trigger automation workflow in n8n",
            "Email stakeholders a progress summary",
        ),
        sample_outcomes=(
            "Grow revenue 25% this quarter",
            "Cut costs without laying off",
            "Automate weekly reporting",
        ),
        business_ideas=(
            "B2B SaaS for invoice automation",
            "Local service marketplace app",
            "Subscription box for office snacks",
            "AI customer support for SMBs",
            "Fractional COO service for startups",
        ),
    ),
}


def get_niche(niche_id: str | None) -> NicheMode:
    if niche_id and niche_id in NICHES:
        return NICHES[niche_id]
    return NICHES["general"]


def all_niche_ids() -> list[str]:
    return list(NICHES.keys())


def random_business_idea(niche_id: str | None, market: str = "") -> dict:
    import random

    niche = get_niche(niche_id)
    idea = random.choice(niche.business_ideas)
    if market:
        idea = f"{idea} — focused on {market}"
    return {
        "idea": idea,
        "niche": niche.id,
        "niche_label": niche.label,
        "suggested_command": f"Build a 30-day launch plan for: {idea}",
        "first_steps": [
            "Validate demand with 10 customer interviews",
            "Set up landing page + payment (Stripe)",
            "Run £50/day test ads for 7 days",
            "Book 5 sales calls from leads",
            "Review metrics and double down on best channel",
        ],
    }
