# BatchMaker - Professional Bakery Workflow Management

BatchMaker is a comprehensive production management system designed for commercial bakeries and food production facilities. It combines workflow automation, batch tracking, timer management, and team coordination into a single platform.

## 🎯 Core Features

### 1. Workflow Management
Create, organize, and execute production workflows with precision timing and ingredient tracking.

**Features:**
- **Custom Workflow Builder**: Create workflows from scratch with step-by-step instructions
- **AI Recipe Parser**: Import recipes from text or URLs using Claude AI
  - Automatic ingredient extraction and scaling
  - Smart step detection and timer assignment
  - URL caching (popular recipes cached for instant imports)
- **Workflow Editor**: Edit existing workflows with full WYSIWYG interface
- **Archive System**: Archive/unarchive workflows without deletion
- **Checklist Items**: Add ingredient checklists to each step for quality control
- **YouTube Integration**: Embed reference videos for training
- **Batch Scaling**: Multiply recipes by 0.5x, 1x, 2x, 3x, or custom amounts

### 2. Batch Tracking & Execution
Real-time tracking of production batches with multi-station support.

**Features:**
- **Bake Today Mode**: Immediate production workflow (🟢)
- **Cold Ferment Mode**: Multi-day production with overnight rest (🔵)
- **Batch Claiming**: Station-based ownership system
  - Claim batches to show ownership
  - See which station is working on what
  - Filter "My Workflows" tab for personal batches
- **Progress Tracking**: Visual completion status for each step
- **Batch Duplication**: Clone existing batches with all settings
- **Batch Renaming**: Custom names for tracking multiple batches
- **Long-Press Menus**: Quick actions (rename, duplicate, claim, delete)

### 3. Timer System
Production-grade timer management with visual alerts.

**Features:**
- **Multiple Active Timers**: Track multiple steps simultaneously
- **Urgent Timer Display**: Shows most critical timer across all batches
- **Expiration Alerts**: Flashing red borders when timers expire
- **Timer Acknowledgment**: Acknowledge completed timers
- **Background Persistence**: Timers continue even when app is closed
- **Batch-Level Timers**: See all active timers per batch

### 4. Step Execution
Interactive step-by-step workflow execution with real-time updates.

**Features:**
- **Step-by-Step Navigation**: Large, easy-to-read instructions
- **Ingredient Checklists**: Check off items as you add them
- **Inline Timer Controls**: Start/stop timers without leaving the step
- **Completion Tracking**: Mark steps complete with visual feedback
- **Progress Indicators**: See exactly where you are in the workflow
- **Video References**: Quick access to training videos per step

### 5. Multi-User Coordination
Team collaboration features for production facilities.

**Features:**
- **Station Names**: Each device can set a custom station name
- **Workflow Claiming**: Claim workflows to prevent conflicts
- **Real-Time Sync**: Changes sync across all stations via Supabase
- **Claimed Batch Indicators**: See who owns each batch
- **My Workflows Tab**: Filter view to only your claimed batches
- **Device Management**: Multiple tablets/phones per location

### 6. Import System
Flexible import options for existing recipe collections.

**Features:**
- **URL Import**: Parse recipes directly from websites
  - Automatic caching of popular recipes
  - Smart ingredient and step extraction
  - Works with most recipe sites
- **Text Import**: Paste recipe text for AI parsing
- **Excel/Spreadsheet Import**: Bulk import from `.xlsx` files
- **Settings Integration**: Access all import options from settings menu

### 7. User Interface
Clean, production-focused interface built for bakery environments.

**Features:**
- **Dark/Light Themes**: Automatic theme switching
- **Large Touch Targets**: Designed for flour-covered hands
- **Color-Coded Modes**: 🟢 Bake Today, 🔵 Cold Ferment
- **Contextual Menus**: Long-press for quick actions
- **Empty States**: Helpful guidance when lists are empty
- **Loading States**: Clear feedback during operations
- **Error Handling**: User-friendly error messages

### 8. Data Management
Secure, cloud-synced data with offline support.

**Features:**
- **Supabase Backend**: Real-time PostgreSQL database
- **Row-Level Security**: User data isolation
- **Automatic Sync**: Changes sync across devices
- **Local Cache**: In-memory caching for speed
- **Batch Operations**: Efficient bulk updates
- **Rate Limiting**: Prevents API abuse (5/hour, 15/day for AI parsing)

## 🏗️ Technical Stack

### Frontend
- **React Native**: Cross-platform (iOS, Android, Web)
- **Expo Router**: File-based routing
- **TypeScript**: Type-safe development
- **React Context**: State management

### Backend
- **Supabase**: PostgreSQL + Auth + Storage
- **Edge Functions**: Serverless API endpoints
- **Row-Level Security**: Database-level auth
- **Real-time Subscriptions**: Live data sync

### AI Integration
- **Anthropic Claude**: Haiku 4.5 model
- **Smart Caching**: URL-based parse caching
- **Rate Limiting**: Usage controls per user

### Database Schema
```
tables:
- profiles (user metadata, device names)
- workflows (recipes with steps)
- batches (active production runs)
- recipe_parse_logs (usage tracking)
- url_parse_cache (cached AI parses)
```

## 📱 Platforms

- **iOS**: Native app via Expo
- **Android**: Native app via Expo
- **Web**: Progressive Web App
- **Desktop**: Coming soon (Electron wrapper)

## 🔒 Authentication

- Email/password authentication
- Magic link support
- Session management
- JWT-based API auth

## 🚀 Getting Started

### Prerequisites
```bash
Node.js 18+
npm or yarn
Expo CLI
Supabase account
Anthropic API key
```

### Installation
```bash
# Clone repo
git clone <your-repo>
cd batchmaker

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Add your keys:
# EXPO_PUBLIC_SUPABASE_URL=
# EXPO_PUBLIC_SUPABASE_ANON_KEY=
# ANTHROPIC_API_KEY= (server-side only)

# Run locally
npx expo start
```

### Deploy Edge Functions
```bash
# Deploy AI parsing function
supabase functions deploy parse-recipe

# Deploy URL parsing function  
supabase functions deploy parse-recipe-url
```

## 📊 Usage Limits

### Free Tier
- Unlimited workflows
- Unlimited batches
- 5 AI parses per hour
- 15 AI parses per day
- Cached URL parses don't count toward limit

### Premium (Coming Soon)
- Unlimited AI parsing
- Priority support
- Advanced analytics
- Custom integrations

## 🎨 Customization

### Theme Colors
Edit `contexts/ThemeContext.tsx` to customize colors:
```typescript
light: {
  primary: '#007AFF',
  success: '#34C759',
  error: '#FF3B30',
  // ...
}
```

### Workflow Templates
Create default workflows in `data/workflows.json`

## 🤝 Contributing

This is a private project. Contact the owner for access.

## 📄 License

Proprietary - All Rights Reserved

## 🐛 Known Issues

- Timer notifications (background) need native modules
- Excel import requires specific column format
- Some recipe sites block scraping

## 🗺️ Roadmap

- [ ] Desktop app (Electron)
- [ ] Inventory management
- [ ] Cost tracking per batch
- [ ] Production reports/analytics
- [ ] Public recipe directory
- [ ] QR code batch labels
- [ ] Multi-location support
- [ ] Integration with POS systems

## 📞 Support

Contact: [your-email]
Documentation: [link-to-docs]

---

**Built for bakers, by bakers.** 🥖