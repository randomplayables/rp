# randomplayables

### "Turn math ponderings into citizen science games"

Welcome to the official repository for [randomplayables.com](https://www.randomplayables.com)! This platform is dedicated to transforming mathematical concepts into engaging citizen science games that anyone can build, share, and play.

## About The Project

`randomplayables` is a comprehensive platform designed to foster a community around the creation and analysis of math games. It provides tools for developers, researchers, and enthusiasts to build games, collect data, and gain insights, all while rewarding contributions through a unique probabilistic payout system.


### Key Features
* **Random Payables (RP)**: A novel system designed to reward community members for their contributions. It uses a probabilistic model based on points earned from activities like game development, peer reviews, content creation, and community support to distribute a portion of platform profits.
* **Stack**: A dedicated Q&A section where users can ask questions, share knowledge, and help each other with game development, data analysis, and mathematical concepts.
* **User Profiles & Game Submissions**: Users have public profiles to showcase their created games, sketches, and visualizations. A full submission and peer-review pipeline using GitHub integration allows for community-vetted games to be published on the platform.
* **GameLab**: An AI-assisted, in-browser IDE for creating games.
* **DataLab**: An AI-driven tool for analyzing platform data. Users can chat with an AI to generate custom D3.js visualizations from various data sources across the platform, including game data, survey responses, and user contributions. Users can also request JSON from collections.
* **Collect**: An AI-powered survey and instrument builder. It allows users to create questionnaires and data collection tools, with the unique ability to integrate playable games directly into the survey flow.


### Tech Stack

* **Framework**: [Next.js](https://nextjs.org/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Frontend**: [React](https://reactjs.org/)
* **State Management**: [TanStack Query (React Query)](https://tanstack.com/query/latest)
* **Databases**:
    * [MongoDB](https://www.mongodb.com/) (with Mongoose) for game and application data.
    * [PostgreSQL](https://www.postgresql.org/) (with Prisma) for user profiles and subscriptions.
* **Authentication**: [Clerk](https://clerk.com/)
* **Payments & Payouts**: [Stripe](https://stripe.com/) (Subscriptions for users, Connect for contributor payouts)
* **AI Integration**: [OpenAI](https://openai.com/) / [OpenRouter](https://openrouter.ai/) for chat and embedding models.
* **Deployment**: [Vercel](https://vercel.com/).

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* Node.js (v18 or later recommended)
* npm, yarn, or pnpm

### Installation

1.  **Clone the repo**
    ```sh
    git clone [https://github.com/randomplayables/rp.git](https://github.com/randomplayables/rp.git)
    ```
2.  **Install NPM packages**
    ```sh
    npm install
    ```
3.  **Set up environment variables**

    Create a `.env.local` file in the root of the project and add the following variables. You will need to get these keys from their respective platforms (Clerk, Stripe, MongoDB, etc.).

    ```env
    # MONGODB
    MONGODB_URI=your_mongodb_connection_string

    # PRISMA (PostgreSQL)
    DATABASE_URL=your_postgresql_connection_string

    # CLERK
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
    CLERK_SECRET_KEY=your_clerk_secret_key
    CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

    # STRIPE
    STRIPE_SECRET_KEY=your_stripe_secret_key
    STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
    STRIPE_WEBHOOK_CONNECT_SECRET=your_stripe_connect_webhook_secret
    STRIPE_PRICE_PREMIUM=your_stripe_premium_price_id
    STRIPE_PRICE_PREMIUM_PLUS=your_stripe_premium_plus_price_id

    # AI SERVICES
    OPEN_ROUTER_API_KEY=your_open_router_api_key
    OPENAI_API_KEY=your_openai_api_key

    # GITHUB OAUTH & WEBHOOKS
    GITHUB_CLIENT_ID=your_github_oauth_app_client_id
    GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
    GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
    GITHUB_TOKEN=your_github_personal_access_token_for_api_calls

    # NEXT.JS
    NEXT_PUBLIC_BASE_URL=http://localhost:3000
    ```

4.  **Run the development server**
    ```sh
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated** and will be rewarded through the Random Payables system.

Please fork the repo and create a pull request.

### Code of Conduct

This project and everyone participating in it is governed by the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/1/0/0/code-of-conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

randomplayables@proton.me

Project Link: [https://github.com/randomplayables/rp](https://github.com/randomplayables/rp)