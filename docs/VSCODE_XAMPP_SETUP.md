# Run PackSwift with Visual Studio Code and XAMPP

PackSwift uses:

- Visual Studio Code for editing and debugging
- Node.js and Express for the web server
- HTML, CSS, and Vanilla JavaScript for the interface
- XAMPP MySQL for the local database

Apache and PHP are not required to run PackSwift. Start Apache only when you
want to inspect MySQL through phpMyAdmin.

## 1. Install the required software

Install:

- Visual Studio Code
- Node.js 22.13 or newer
- XAMPP with MySQL

Confirm Node.js and npm are available:

```sh
node --version
npm --version
```

## 2. Open the correct folder

Open this folder in Visual Studio Code:

```text
PackSwift/web
```

`package.json` and `server.js` should be visible at the top level of the VS
Code Explorer.

## 3. Start XAMPP MySQL

On macOS:

1. Open `/Applications/XAMPP/manager-osx.app`.
2. Select **Manage Servers**.
3. Start **MySQL Database**.

On Windows:

1. Open the XAMPP Control Panel.
2. Click **Start** beside MySQL.

The default PackSwift configuration expects MySQL at `127.0.0.1:3306`, with
the username `root` and no password.

## 4. Create the local environment file

In the VS Code terminal, run:

### macOS or Linux

```sh
cp .env.xampp.example .env
```

### Windows PowerShell

```powershell
Copy-Item .env.xampp.example .env
```

Open `.env` and replace `JWT_SECRET` with a private random value containing at
least 32 characters.

If the XAMPP root account has a password, enter it after `DB_PASSWORD=`.

For live real-world attraction suggestions, enable Google Places API (New),
create a server-side API key restricted to that API, and add it to `.env`:

```dotenv
GOOGLE_PLACES_API_KEY=your-server-side-google-places-key
```

Leave this value blank to use PackSwift's built-in destination catalog. Never
place the key in frontend JavaScript or commit it to source control.

## 5. Install PackSwift

Run these commands in the VS Code terminal:

```sh
npm install
npm run db:init
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

The development server automatically restarts when backend files change.
Refresh the browser after editing HTML, CSS, or frontend JavaScript.

## 6. Use VS Code tasks instead

Open **Terminal → Run Task** and run:

1. `PackSwift: Install packages`
2. `PackSwift: Create XAMPP database`
3. `PackSwift: Start development server`

To run with the VS Code debugger, open **Run and Debug** and select:

```text
PackSwift: Run website
```

## 7. Optional sample accounts

Run:

```sh
npm run db:seed
```

This adds clearly labelled sample data. The command prints the demonstration
login details after it finishes.

## 8. phpMyAdmin

If Apache is running in XAMPP, open:

```text
http://localhost/phpmyadmin
```

The database name is:

```text
packswift
```

The same database can also be created manually by importing:

```text
database/schema.sql
```

Do not import both the SQL file and run `npm run db:init` during the same
first-time setup. Either method creates the same PackSwift tables.

## Common problems

### MySQL connection refused

Start MySQL in XAMPP and confirm `DB_PORT=3306`. If XAMPP displays another
port, copy that port into `.env`.

### Access denied for root

Set the correct password in:

```dotenv
DB_PASSWORD=your-xampp-root-password
```

### Port 3000 is already in use

Change:

```dotenv
PORT=3001
```

Then open `http://127.0.0.1:3001`.

### Database features do not work

Open:

```text
http://127.0.0.1:3000/api/health
```

The response should include:

```json
{
  "status": "ok",
  "service": "packswift",
  "database": "connected"
}
```

## Validation

Run all PackSwift checks before committing changes:

```sh
npm test
```

## Apply the Part 1 trip-planning upgrade

Existing local databases created before the dynamic trip-planning upgrade
should run this command once while XAMPP MySQL is active:

```sh
/Applications/XAMPP/xamppfiles/bin/mysql -u root packswift -e "SOURCE database/migrations/004_trip_planning_upgrade.sql"
```

Fresh databases created with `npm run db:init` already contain these tables and
must not run the migration again.
