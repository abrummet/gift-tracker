# Gift Tracker

A shared Christmas gift list for two phones. People are sorted into groups (Kids, Siblings, and any
others), each group has a budget split evenly, and kids can have a separate stocking list and budget.
Each gift moves through Idea, Bought, Received and Wrapped.

There is no build step. GitHub Pages serves the files in this folder as they are.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `art.js`: the Christmas pictures
- `config.js`: where the shared list lives (fill this in, step 1)
- `supabase/schema.sql`: the database layout (run once, step 1)
- `vendor/supabase.js`: Supabase's browser library, version 2.119.0
- `prototype.html`: the first layout preview; not used by the app

## Setup

### 1. Supabase

1. Open your Supabase project, go to **SQL Editor**, paste all of `supabase/schema.sql`, press **Run**.
   Everything it creates starts with `gift_`, so it can share a project with another app.
2. Go to **Project Settings > Data API** and copy the **Project URL** and the **publishable** key
   into `config.js`. Never use the secret or service_role key.

Until `config.js` is filled in, the app works but keeps its list on one phone only.

### 2. GitHub

1. Create a repository and put this folder in it.
2. In the repository: **Settings > Pages > Build and deployment > Deploy from a branch**,
   branch `main`, folder `/ (root)`.
3. The app appears at `https://<your-username>.github.io/<repository-name>/` after a minute or two.

### 3. Phones

1. Open the address in Safari, tap **Share**, then **Add to Home Screen**.
2. On the first phone, type a family code (at least 6 characters) and tap **Start a new list with this code**.
3. On the second phone, type the same code and tap **Open our list**.

Anyone who has the code can see and change the list, so pick something that is not easy to guess.
