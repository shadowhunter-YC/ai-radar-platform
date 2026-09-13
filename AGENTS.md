# AI Radar Platform - Project Rules & Guidelines

## 1. UI & Design Rules
- **STRICTLY NO EMOJI ICONS**: Absolutely do not use emoji icons (e.g. 🏛️, 🛡️, 🚨, 🏷️, ⚡, 🤖, 📥, ⏳, ⚙️, 🎯, 🔍, ⏸️, 📡, 🧠, 💡, 🔄, etc.) anywhere in the application. This includes page headings, buttons, tags, badges, modals, toast messages, reports, and table headers.
- **Deloitte Design Language**: Maintain a clean, minimalist corporate consulting visual aesthetic. Rely on typography, font hierarchy, subtle borders, and calibrated brand colors (#86bc25 Deloitte green, #000000 pure black, #ffffff white, neutral slates #64748b, #e2e8f0).
- **Responsive & Clean**: Ensure layouts adapt gracefully across desktop and mobile without horizontal overflows.

## 2. Data Integrity Rules
- **Transparent Mock vs Real Distinction**: Clearly inform users about what is pre-seeded sample data (lib/mock-data.js) versus what is real crawled intelligence from SQLite.
- **Filter Linkage**: All interactive cards, dropdowns, and filters must be genuinely linked to the underlying article feeds and dashboard metrics.
