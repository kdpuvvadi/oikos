# 💸 Oikos

I built this simple expense management system using **Express** and **PocketBase**. It’s designed to be a lightweight, self-hosted way to track where your money is going without the bloat of major commercial apps.

It uses the PocketBase JavaScript SDK to handle the heavy lifting on the backend, while the frontend is kept clean with standard HTML, CSS, and JS.

## What’s inside?

  * **Smart Dashboard:** Get a quick bird's-eye view of your spending for this month vs. last month.
  * **Flexible Entry:** Log expenses with dates, categories, subcategories, and specific stores.
  * **On-the-fly Creation:** If you're entering a transaction and realize the category or store doesn't exist yet, you can create it right then and there without leaving the form.
  * **Deep Dives:** Manage your categories and stores separately.
      * Full transaction history with easy "delete" actions.
      * **Pivot-style filters:** This is my favorite part—you can choose your own row and column dimensions to see exactly how your data aggregates.
  * **Privacy First:** Transactions are linked to your specific PocketBase user record. Regular users only see their own data, while admins (flagged with `kind=admin`) can manage the global categories and see the full picture.

## Getting Started (The Easy Way)

If you have **Docker** installed, you can get this running in about 60 seconds.

### 1. Fire up the containers

This will build the Express UI and pull the PocketBase image.

```bash
docker compose up --build
```

### 2. Access the apps

  * **The App:** [http://localhost:3000](http://localhost:3000)
  * **PocketBase Admin:** [http://localhost:8090/_/](http://localhost:8090/_/)

> **Note:** If you’re already running something on these ports, just copy `.env.example` to `.env` and tweak the `APP_PORT` or `PB_PORT` values.

### 3. Initialize your Database

The first time you run this, go to the PocketBase admin UI and create your admin account. Then, run the setup script to generate the collections and schema:

```bash
docker compose exec oikos npm run setup:pocketbase
```

The script is idempotent, so you can run it whenever you update the app to make sure your database schema stays in sync.

### 4. Admin Privileges

If you want to be able to rename categories or see all transactions, make your user an admin:

```bash
docker compose exec oikos npm run make:admin
```

## Running Locally (No Docker)

If you prefer to run things natively:

1.  **Start PocketBase:** Make sure you have a PocketBase server running (usually at `http://127.0.0.1:8090`).
2.  **Install Deps:**

    ```bash
    npm install
    ```

3.  **Sync Schema:** Run the setup script and follow the prompts for your admin credentials.

    ```bash
    npm run setup:pocketbase
    ```
4.  **Go**

    ```bash
    npm start
    ```

## A few technical notes

The app relies on four main collections in PocketBase: `oikos_categories`, `oikos_subcategories`, `oikos_stores`, and `oikos_transactions`.

