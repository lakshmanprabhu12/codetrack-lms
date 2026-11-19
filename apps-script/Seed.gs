/**
 * Seed syllabus loaded by setup(). Generated from syllabus.json.
 * To change the syllabus later, use Admin > Syllabus > JSON instead of editing this file.
 */
function getSeedSyllabus() {
  return {
    "version": 1,
    "course": "Python Basics Internship",
    "tracks": [
      {
        "id": "data",
        "name": "Data Analysis",
        "icon": "query_stats",
        "description": "Turn raw data into answers with NumPy, Pandas and charts. Great if you enjoy numbers, Excel or dashboards."
      },
      {
        "id": "web",
        "name": "Web Development",
        "icon": "language",
        "description": "Build real websites and web apps with HTML, CSS, Flask and SQLite. Great if you like making things people can use."
      },
      {
        "id": "auto",
        "name": "Automation & Scripting",
        "icon": "smart_toy",
        "description": "Make the computer do boring work for you: files, Excel, web scraping, APIs and command-line tools."
      },
      {
        "id": "ai",
        "name": "AI & Machine Learning",
        "icon": "psychology",
        "description": "Teach computers to learn from data with scikit-learn: regression, classification and model evaluation."
      }
    ],
    "weeks": [
      {
        "week": 1,
        "title": "Foundations",
        "published": true
      },
      {
        "week": 2,
        "title": "Data Structures, Functions & Choosing Your Path",
        "published": false
      },
      {
        "week": 3,
        "title": "Track Deep-Dive",
        "published": false
      },
      {
        "week": 4,
        "title": "Build & Present",
        "published": false
      }
    ],
    "days": [
      {
        "id": "d01",
        "day": 1,
        "week": 1,
        "date": "2026-11-19",
        "track": "common",
        "title": "Setup & First Program",
        "scrum": "Introductions, what Python is and why it matters, install check (Python + VS Code) on every laptop.",
        "paper": "Write the steps a computer needs to greet someone and to print a bio card, in plain English. What happens if a step is missing?",
        "code": "`print()`, `input()`, comments, running a `.py` file from the terminal. Build a greeting program and a Bio Card.",
        "outcomes": "Run Python from the terminal and VS Code; use print() and input(); store values in variables."
      },
      {
        "id": "d02",
        "day": 2,
        "week": 1,
        "date": "2026-11-20",
        "track": "common",
        "title": "Variables & Data Types",
        "scrum": "Recap print/input. Variables as labelled boxes; int, float, str and bool on the board.",
        "paper": "Identify the type of `10`, `3.14`, `\"hello\"`, `True`, `\"25\"`. Trace swapping two variables step by step.",
        "code": "`type()`, casting with `int()`, `float()`, `str()`, `bool()`; why `input()` always returns a string.",
        "outcomes": "Choose the right data type; convert between types; explain why '5' + '3' is '53'."
      },
      {
        "id": "d03",
        "day": 3,
        "week": 1,
        "date": "2026-11-23",
        "track": "common",
        "title": "Operators",
        "scrum": "Recap data types. Arithmetic, comparison and logical operators with everyday examples.",
        "paper": "Evaluate by hand: `17 // 5`, `17 % 5`, `2 ** 5`, `True and not False`. Fill a truth table for and/or.",
        "code": "Build a calculator that prints +, -, *, /, //, %, ** for two numbers. Use % to test even/odd.",
        "outcomes": "Use all arithmetic operators; read comparison and logical expressions; predict results before running."
      },
      {
        "id": "d04",
        "day": 4,
        "week": 1,
        "date": "2026-11-24",
        "track": "common",
        "title": "Strings",
        "scrum": "Recap operators. Strings as sequences: indexing, negative indexing and slicing on the board.",
        "paper": "For `s = \"PYTHON\"` predict `s[0]`, `s[-1]`, `s[1:4]`, `s[::-1]`. Reverse a word letter by letter on paper.",
        "code": "String methods: `upper`, `lower`, `strip`, `replace`, `split`, `join`, `count`, f-strings.",
        "outcomes": "Slice strings confidently; clean and format text with string methods and f-strings."
      },
      {
        "id": "d05",
        "day": 5,
        "week": 1,
        "date": "2026-11-25",
        "track": "common",
        "title": "Conditionals",
        "scrum": "Recap strings. Decision making with if / elif / else drawn as a flowchart.",
        "paper": "Draw a flowchart for: marks >= 90 → A, >= 75 → B, >= 60 → C, else Fail. Trace it with marks = 82 and 59.",
        "code": "Implement the grade checker. Build a ticket pricing program with nested conditions (child / adult / senior, weekday / weekend).",
        "outcomes": "Write if/elif/else chains; combine conditions with and/or; trace branches on paper first."
      },
      {
        "id": "d06",
        "day": 6,
        "week": 1,
        "date": "2026-11-26",
        "track": "common",
        "title": "Loops",
        "scrum": "Recap conditionals. `for` and `while` loops, `range()`, loop anatomy, break and continue.",
        "paper": "Trace `for i in range(5)` iteration by iteration. Trace a while countdown from 10. Spot an infinite loop.",
        "code": "Multiplication table with for, sum of first N numbers with while, a number guessing game.",
        "outcomes": "Repeat work with for/while; use range, break and continue; trace loops by hand."
      },
      {
        "id": "d07",
        "day": 7,
        "week": 1,
        "date": "2026-11-27",
        "track": "common",
        "title": "Week 1 Recap & Challenge",
        "scrum": "Open Q&A on Days 1-6. Each intern teaches one concept back to the group in 1 minute.",
        "paper": "Written mini-quiz: 10 short questions on types, operators, slicing, conditionals and loop tracing.",
        "code": "Coding challenges: FizzBuzz, reverse a string without slicing, check whether a number is prime.",
        "outcomes": "Combine Week 1 concepts to solve small problems end to end."
      },
      {
        "id": "d08",
        "day": 8,
        "week": 2,
        "date": "2026-11-30",
        "track": "common",
        "title": "Lists",
        "scrum": "Recap Week 1. Lists as ordered, changeable collections; indexing, slicing, mutability.",
        "paper": "For `fruits = [\"apple\", \"banana\", \"cherry\", \"date\"]` predict the list after append, insert, pop and remove.",
        "code": "List methods, looping over lists, `in`, `len`, `sorted`, `sum`, `max`. Build a to-do list manager.",
        "outcomes": "Store and manipulate collections with lists; loop over lists; choose the right list method."
      },
      {
        "id": "d09",
        "day": 9,
        "week": 2,
        "date": "2026-12-01",
        "track": "common",
        "title": "Tuples & Sets",
        "scrum": "Recap lists. Tuples (unchangeable) and sets (unique, unordered) with real-world analogies.",
        "paper": "List which operations work on tuples vs lists. For two sets, compute union, intersection and difference by hand.",
        "code": "Tuple unpacking, returning multiple values, removing duplicates with sets, set operations.",
        "outcomes": "Decide between list, tuple and set; use set operations to compare groups."
      },
      {
        "id": "d10",
        "day": 10,
        "week": 2,
        "date": "2026-12-02",
        "track": "common",
        "title": "Dictionaries",
        "scrum": "Recap tuples/sets. Dictionaries as key-value pairs (a phone book analogy). Nested data.",
        "paper": "Trace lookups, additions and updates on a student dict. Design a dict for a mini phone book on paper.",
        "code": "CRUD on dictionaries, `.get()`, `.items()`, looping, counting with dicts. Build a contact book.",
        "outcomes": "Model real data with dictionaries; loop over keys and values; count things with a dict."
      },
      {
        "id": "d11",
        "day": 11,
        "week": 2,
        "date": "2026-12-03",
        "track": "common",
        "title": "Functions",
        "scrum": "Recap dicts. Why functions (DRY), def, parameters, return vs print, default arguments, scope.",
        "paper": "Write pseudocode for: is_even(n), max_of_three(a, b, c), and a function that returns min, max and average of a list.",
        "code": "Implement the functions; default arguments; `*args`; local vs global variables; docstrings.",
        "outcomes": "Write reusable functions with parameters and return values; avoid repeating code."
      },
      {
        "id": "d12",
        "day": 12,
        "week": 2,
        "date": "2026-12-04",
        "track": "common",
        "title": "Files, Errors & Choosing Your Path",
        "scrum": "Recap functions. Reading/writing files with `with open`, and try/except for errors. Tour of the 4 tracks — pick yours in CodeTrack today.",
        "paper": "Plan a 'marks register': which data structure, which functions, what goes in the file, what can go wrong (missing file, bad input)?",
        "code": "Read/write/append text files; handle FileNotFoundError and ValueError; build the marks register.",
        "outcomes": "Save and load data from files; handle errors gracefully; choose a specialization track."
      },
      {
        "id": "d13-ai",
        "day": 13,
        "week": 3,
        "date": "2026-12-07",
        "track": "ai",
        "title": "Modules, pip & NumPy for ML",
        "scrum": "import, pip, venvs; arrays as the language of ML.",
        "paper": "Compute mean and spread of a small dataset by hand.",
        "code": "Install numpy, array maths, random numbers, simple statistics.",
        "outcomes": "Use NumPy for numeric data."
      },
      {
        "id": "d13-auto",
        "day": 13,
        "week": 3,
        "date": "2026-12-07",
        "track": "auto",
        "title": "Modules, pip & Working with Files",
        "scrum": "import, pip, venvs; the `os`, `pathlib` and `shutil` modules.",
        "paper": "Write the steps to organise a messy Downloads folder by file type.",
        "code": "List files, read sizes and extensions, create folders with pathlib.",
        "outcomes": "Navigate the file system from Python."
      },
      {
        "id": "d13-data",
        "day": 13,
        "week": 3,
        "date": "2026-12-07",
        "track": "data",
        "title": "Modules, pip & NumPy Intro",
        "scrum": "import, pip, virtual environments. Why NumPy is faster than lists.",
        "paper": "Given 7 days of sales, compute total, average and best day by hand.",
        "code": "Create a venv, `pip install numpy`, create arrays, vectorised maths, `mean`, `max`, `argmax`.",
        "outcomes": "Install packages; use NumPy arrays for fast numeric work."
      },
      {
        "id": "d13-web",
        "day": 13,
        "week": 3,
        "date": "2026-12-07",
        "track": "web",
        "title": "Modules, pip & How the Web Works",
        "scrum": "Browser ↔ server, HTTP requests and responses, URLs, status codes.",
        "paper": "Draw what happens when you type a URL and press Enter, step by step.",
        "code": "Create a venv, `pip install flask`, run a Hello World Flask app.",
        "outcomes": "Explain the request/response cycle; run a Flask server."
      },
      {
        "id": "d14-ai",
        "day": 14,
        "week": 3,
        "date": "2026-12-08",
        "track": "ai",
        "title": "Pandas for ML",
        "scrum": "Datasets, features and labels, rows and columns.",
        "paper": "Look at the Iris table on paper: which columns are features, which is the label?",
        "code": "Load iris/titanic with pandas, inspect, handle missing values, select features.",
        "outcomes": "Prepare a dataset for machine learning."
      },
      {
        "id": "d14-auto",
        "day": 14,
        "week": 3,
        "date": "2026-12-08",
        "track": "auto",
        "title": "File Automation",
        "scrum": "Bulk rename, move and copy safely; dry runs before real runs.",
        "paper": "Design rename rules for 20 messy file names on paper.",
        "code": "Organise files into folders by type, bulk rename with patterns, add a --dry-run mode.",
        "outcomes": "Automate repetitive file tasks safely."
      },
      {
        "id": "d14-data",
        "day": 14,
        "week": 3,
        "date": "2026-12-08",
        "track": "data",
        "title": "NumPy in Depth",
        "scrum": "2D arrays, shapes, indexing, slicing, boolean masks, axis.",
        "paper": "Draw a 3x4 marks matrix; compute row and column averages by hand.",
        "code": "Reshape, slice rows/columns, boolean filtering, aggregations by axis.",
        "outcomes": "Slice and filter 2D data; aggregate along rows and columns."
      },
      {
        "id": "d14-web",
        "day": 14,
        "week": 3,
        "date": "2026-12-08",
        "track": "web",
        "title": "HTML & CSS Essentials",
        "scrum": "HTML tags, structure, links, images, forms; CSS selectors and the box model.",
        "paper": "Sketch your profile page layout and label every HTML element.",
        "code": "Build a static profile page with HTML + CSS.",
        "outcomes": "Write semantic HTML and basic CSS."
      },
      {
        "id": "d15-ai",
        "day": 15,
        "week": 3,
        "date": "2026-12-09",
        "track": "ai",
        "title": "Visualising Data",
        "scrum": "Seeing patterns before modelling: scatter, histogram, correlation.",
        "paper": "Guess from a sketched scatter plot whether two variables are related.",
        "code": "Matplotlib scatter/hist, pandas `corr()`.",
        "outcomes": "Explore relationships in data visually."
      },
      {
        "id": "d15-auto",
        "day": 15,
        "week": 3,
        "date": "2026-12-09",
        "track": "auto",
        "title": "CSV & Excel Automation",
        "scrum": "The csv module and openpyxl; reading, writing and merging sheets.",
        "paper": "Plan how to merge 3 monthly sheets into one yearly report.",
        "code": "Read/write CSV, read/write Excel with openpyxl, merge files.",
        "outcomes": "Automate spreadsheet work."
      },
      {
        "id": "d15-data",
        "day": 15,
        "week": 3,
        "date": "2026-12-09",
        "track": "data",
        "title": "Pandas Basics",
        "scrum": "Series vs DataFrame, reading CSV files, head, info, describe.",
        "paper": "Sketch a table for a small shop's sales and list 5 questions you would ask it.",
        "code": "`read_csv`, selecting columns, filtering rows, sorting, `value_counts`.",
        "outcomes": "Load and explore tabular data with Pandas."
      },
      {
        "id": "d15-web",
        "day": 15,
        "week": 3,
        "date": "2026-12-09",
        "track": "web",
        "title": "Flask Templates",
        "scrum": "Jinja templates, passing data to pages, loops and ifs in templates, template inheritance.",
        "paper": "Design 3 pages that share one layout; mark what changes and what stays.",
        "code": "`render_template`, base layout with `{% block %}`, loops over lists of data.",
        "outcomes": "Render dynamic pages from Python data."
      },
      {
        "id": "d16-ai",
        "day": 16,
        "week": 3,
        "date": "2026-12-10",
        "track": "ai",
        "title": "What Is Machine Learning?",
        "scrum": "Supervised vs unsupervised, training vs testing, overfitting in plain words.",
        "paper": "Fit a straight line by hand to 6 points and use it to predict a new value.",
        "code": "scikit-learn workflow: `train_test_split`, fit, predict; a baseline model.",
        "outcomes": "Explain the ML workflow and split data correctly."
      },
      {
        "id": "d16-auto",
        "day": 16,
        "week": 3,
        "date": "2026-12-10",
        "track": "auto",
        "title": "Regex & Text Processing",
        "scrum": "Regular expressions: patterns for emails, phone numbers, dates.",
        "paper": "Write patterns by hand for 5 kinds of text and test them mentally.",
        "code": "`re.search`, `re.findall`, `re.sub`, groups.",
        "outcomes": "Extract and clean text with regular expressions."
      },
      {
        "id": "d16-data",
        "day": 16,
        "week": 3,
        "date": "2026-12-10",
        "track": "data",
        "title": "Data Cleaning",
        "scrum": "Real data is messy: missing values, wrong types, duplicates, inconsistent text.",
        "paper": "Given a messy table on paper, mark every problem and decide how to fix each one.",
        "code": "`isna`, `fillna`, `dropna`, `astype`, `drop_duplicates`, `str.strip/lower`, date parsing.",
        "outcomes": "Find and fix common data quality problems."
      },
      {
        "id": "d16-web",
        "day": 16,
        "week": 3,
        "date": "2026-12-10",
        "track": "web",
        "title": "Forms & Requests",
        "scrum": "GET vs POST, reading form data, validation, redirects.",
        "paper": "Flowchart a feedback form: submit → validate → save → thank-you page.",
        "code": "`request.form`, validation messages, `redirect`, `url_for`.",
        "outcomes": "Handle user input safely in a web app."
      },
      {
        "id": "d17-ai",
        "day": 17,
        "week": 3,
        "date": "2026-12-11",
        "track": "ai",
        "title": "Linear Regression",
        "scrum": "Predicting numbers; slope and intercept; error metrics.",
        "paper": "Calculate errors for 5 predictions by hand (MAE).",
        "code": "`LinearRegression`, coefficients, MAE and R².",
        "outcomes": "Train and evaluate a regression model."
      },
      {
        "id": "d17-auto",
        "day": 17,
        "week": 3,
        "date": "2026-12-11",
        "track": "auto",
        "title": "APIs with requests",
        "scrum": "What an API is, JSON, status codes, API keys, rate limits.",
        "paper": "Read a sample JSON response and write the path to 5 values.",
        "code": "`requests.get`, parsing JSON, handling errors and timeouts.",
        "outcomes": "Fetch and use live data from web APIs."
      },
      {
        "id": "d17-data",
        "day": 17,
        "week": 3,
        "date": "2026-12-11",
        "track": "data",
        "title": "GroupBy, Pivot & Merge",
        "scrum": "Split-apply-combine. Joining tables like VLOOKUP.",
        "paper": "Group a small sales table by region by hand and compute totals.",
        "code": "`groupby().agg()`, `pivot_table`, `merge`, `concat`.",
        "outcomes": "Summarise data by groups; combine related tables."
      },
      {
        "id": "d17-web",
        "day": 17,
        "week": 3,
        "date": "2026-12-11",
        "track": "web",
        "title": "Classes & Data Models",
        "scrum": "OOP basics: class, object, __init__, methods; modelling data as classes.",
        "paper": "Design a Note class on paper: attributes and methods.",
        "code": "Write classes, save and load objects as JSON.",
        "outcomes": "Model app data with classes; persist it to JSON."
      },
      {
        "id": "d18-ai",
        "day": 18,
        "week": 4,
        "date": "2026-12-14",
        "track": "ai",
        "title": "Classification",
        "scrum": "Predicting categories: KNN and decision trees.",
        "paper": "Classify 3 new flowers by hand using nearest neighbours.",
        "code": "`KNeighborsClassifier`, `DecisionTreeClassifier` on Iris, accuracy.",
        "outcomes": "Train classifiers and compare predictions."
      },
      {
        "id": "d18-auto",
        "day": 18,
        "week": 4,
        "date": "2026-12-14",
        "track": "auto",
        "title": "Web Scraping",
        "scrum": "HTML structure, BeautifulSoup, scraping ethics and robots.txt.",
        "paper": "Inspect a page structure on paper and plan which tags to read.",
        "code": "Scrape quotes.toscrape.com: all quotes, authors and tags across pages.",
        "outcomes": "Collect data from websites responsibly."
      },
      {
        "id": "d18-data",
        "day": 18,
        "week": 4,
        "date": "2026-12-14",
        "track": "data",
        "title": "Visualisation with Matplotlib",
        "scrum": "Choosing the right chart: line, bar, histogram, pie, scatter.",
        "paper": "Sketch the best chart for 4 different questions and explain why.",
        "code": "Plot with matplotlib and pandas `.plot()`, titles, labels, saving figures.",
        "outcomes": "Communicate findings with clear charts."
      },
      {
        "id": "d18-web",
        "day": 18,
        "week": 4,
        "date": "2026-12-14",
        "track": "web",
        "title": "Databases with SQLite",
        "scrum": "Tables, rows, primary keys; SQL CREATE, INSERT, SELECT, UPDATE, DELETE.",
        "paper": "Write SQL by hand for 5 tasks on a students table.",
        "code": "`sqlite3` in Python, connecting Flask to a database.",
        "outcomes": "Store app data in a real database."
      },
      {
        "id": "d19-ai",
        "day": 19,
        "week": 4,
        "date": "2026-12-15",
        "track": "ai",
        "title": "Evaluating & Saving Models",
        "scrum": "Accuracy isn't everything: confusion matrix, precision/recall, cross-validation.",
        "paper": "Fill a confusion matrix by hand from 10 predictions.",
        "code": "`confusion_matrix`, `classification_report`, `cross_val_score`, saving with joblib.",
        "outcomes": "Evaluate models properly and save the best one."
      },
      {
        "id": "d19-auto",
        "day": 19,
        "week": 4,
        "date": "2026-12-15",
        "track": "auto",
        "title": "CLI Tools & Scheduling",
        "scrum": "argparse, logging, running scripts on a schedule (Task Scheduler / cron).",
        "paper": "Design the command-line options for one of your earlier scripts.",
        "code": "Turn a script into a CLI with argparse and logging; schedule it.",
        "outcomes": "Package scripts as reusable command-line tools."
      },
      {
        "id": "d19-data",
        "day": 19,
        "week": 4,
        "date": "2026-12-15",
        "track": "data",
        "title": "Excel Automation & Mini Report",
        "scrum": "Reading/writing Excel, putting an analysis pipeline together.",
        "paper": "Plan an end-to-end analysis: question → data → clean → analyse → chart → answer.",
        "code": "`read_excel`, `to_excel`, multiple sheets, a reusable analysis script.",
        "outcomes": "Build a repeatable analysis that outputs an Excel report."
      },
      {
        "id": "d19-web",
        "day": 19,
        "week": 4,
        "date": "2026-12-15",
        "track": "web",
        "title": "Polish & Deploy Basics",
        "scrum": "Static files, error pages, simple styling, how deployment works.",
        "paper": "Make a checklist of what a user needs to trust and use your app.",
        "code": "Add CSS, a 404 page, flash messages; walk through deploying to a free host.",
        "outcomes": "Polish an app and understand deployment."
      },
      {
        "id": "d20-ai",
        "day": 20,
        "week": 4,
        "date": "2026-12-16",
        "track": "ai",
        "title": "Capstone Build",
        "scrum": "Pick a dataset and a prediction question; agree scope.",
        "paper": "Plan: data, features, model, metric, success criteria.",
        "code": "Build the end-to-end ML project.",
        "outcomes": "Deliver a complete ML mini project."
      },
      {
        "id": "d20-auto",
        "day": 20,
        "week": 4,
        "date": "2026-12-16",
        "track": "auto",
        "title": "Capstone Build",
        "scrum": "Pick a real task to automate; agree scope.",
        "paper": "Map the manual process step by step, then the automated version.",
        "code": "Build the automation end to end.",
        "outcomes": "Deliver a useful automation tool."
      },
      {
        "id": "d20-data",
        "day": 20,
        "week": 4,
        "date": "2026-12-16",
        "track": "data",
        "title": "Capstone Build",
        "scrum": "Pick a dataset and 3-5 questions; instructor approves scope.",
        "paper": "Plan the analysis on paper: questions, cleaning steps, charts.",
        "code": "Build the full analysis: clean, analyse, chart, and write findings.",
        "outcomes": "Deliver a complete data analysis project."
      },
      {
        "id": "d20-web",
        "day": 20,
        "week": 4,
        "date": "2026-12-16",
        "track": "web",
        "title": "Capstone Build",
        "scrum": "Pick your app idea (to-do, library, expense tracker...) and agree scope.",
        "paper": "Sketch pages, routes and database tables.",
        "code": "Build a full CRUD Flask app.",
        "outcomes": "Deliver a working web application."
      },
      {
        "id": "d21",
        "day": 21,
        "week": 4,
        "date": "2026-12-17",
        "track": "common",
        "title": "Capstone Presentations",
        "scrum": "Each intern presents their capstone: 5-minute demo + Q&A.",
        "paper": "Peer review: write 2 things you liked about a classmate's project and 1 suggestion.",
        "code": "Code review session: common patterns, best practices, how to keep learning after the internship.",
        "outcomes": "Present your work clearly; give and receive feedback; plan your next steps."
      }
    ],
    "assignments": [
      {
        "id": "a01",
        "dayId": "d01",
        "track": "common",
        "title": "Bio Card program",
        "description": "Write `bio_card.py` that asks for your name, age, city, favourite colour and hobby, then prints a neat bio card.\nBonus: draw a border around the card using `print('=' * 30)`.",
        "due": "2026-11-19T23:59",
        "active": true
      },
      {
        "id": "a02",
        "dayId": "d02",
        "track": "common",
        "title": "Type detective",
        "description": "Ask the user for 4 values (age, height, name, 'is student? yes/no'). Convert each to the right type and print the value and its `type()`.\nThen swap two numbers with and without a third variable.",
        "due": "2026-11-20T23:59",
        "active": true
      },
      {
        "id": "a03",
        "dayId": "d03",
        "track": "common",
        "title": "Smart calculator",
        "description": "Take two numbers from the user and print the result of every arithmetic operator with a clear label.\nAlso print whether each number is even or odd.",
        "due": "2026-11-23T23:59",
        "active": true
      },
      {
        "id": "a04",
        "dayId": "d04",
        "track": "common",
        "title": "Username generator",
        "description": "Ask for first and last name. Create a username: first 3 letters of first name + last 3 letters of last name + total name length, all lowercase.\nAlso print how many vowels are in the full name (hint: `.count()`).",
        "due": "2026-11-24T23:59",
        "active": true
      },
      {
        "id": "a05",
        "dayId": "d05",
        "track": "common",
        "title": "Grade & ticket checker",
        "description": "Part 1: read marks (0-100) and print the grade. Reject marks outside 0-100.\nPart 2: read age and day of week; print the ticket price using your own price rules.",
        "due": "2026-11-25T23:59",
        "active": true
      },
      {
        "id": "a06",
        "dayId": "d06",
        "track": "common",
        "title": "Loop lab",
        "description": "1. Print the multiplication table of any number.\n2. Sum the digits of a number (e.g. 4096 → 19).\n3. Number guessing game: computer picks 1-50, user guesses until correct, show 'higher'/'lower' hints and the number of attempts.",
        "due": "2026-11-26T23:59",
        "active": true
      },
      {
        "id": "a07",
        "dayId": "d07",
        "track": "common",
        "title": "Week 1 challenge set",
        "description": "Submit one file with three solutions:\n1. FizzBuzz for 1-50.\n2. Reverse a string without using `[::-1]`.\n3. Prime checker that prints all primes below 100.",
        "due": "2026-11-27T23:59",
        "active": true
      },
      {
        "id": "a08",
        "dayId": "d08",
        "track": "common",
        "title": "To-do list manager",
        "description": "Menu-driven program: 1) add task 2) remove task 3) show tasks 4) mark done 5) quit.\nKeep running until the user quits. Show tasks numbered.",
        "due": "2026-11-30T23:59",
        "active": true
      },
      {
        "id": "a09",
        "dayId": "d09",
        "track": "common",
        "title": "Unique visitors",
        "description": "Given two lists of visitor names (Monday and Tuesday, with repeats):\n- print unique visitors for each day\n- visitors who came both days\n- visitors who came only on Monday\n- total unique visitors.",
        "due": "2026-12-01T23:59",
        "active": true
      },
      {
        "id": "a10",
        "dayId": "d10",
        "track": "common",
        "title": "Contact book + word counter",
        "description": "1. Contact book: add, search, update, delete and list contacts (name → phone).\n2. Word counter: read a sentence and print how many times each word appears.",
        "due": "2026-12-02T23:59",
        "active": true
      },
      {
        "id": "a11",
        "dayId": "d11",
        "track": "common",
        "title": "Function toolkit",
        "description": "Write and test these functions in one file: `is_prime(n)`, `factorial(n)`, `celsius_to_fahrenheit(c)`, `stats(*nums)` returning (min, max, average), and `greet(name, greeting='Hello')`.",
        "due": "2026-12-03T23:59",
        "active": true
      },
      {
        "id": "a12",
        "dayId": "d12",
        "track": "common",
        "title": "Marks register",
        "description": "Program that adds student marks, saves them to `marks.txt`, loads them back on start, and prints the class average.\nHandle a missing file and non-number input without crashing.\nAlso: request your track in CodeTrack → My track.",
        "due": "2026-12-04T23:59",
        "active": true
      },
      {
        "id": "a21",
        "dayId": "d21",
        "track": "common",
        "title": "Peer review & reflection",
        "description": "Paste your peer review notes for two classmates and a short reflection: what you learned in 21 days and what you will build next.",
        "due": "2026-12-17T23:59",
        "active": true
      },
      {
        "id": "a13-data",
        "dayId": "d13-data",
        "track": "data",
        "title": "Sales stats with NumPy",
        "description": "Store 14 days of sales in a NumPy array. Print total, average, best and worst day, and days above average.",
        "due": "2026-12-07T23:59",
        "active": true
      },
      {
        "id": "a14-data",
        "dayId": "d14-data",
        "track": "data",
        "title": "Marks matrix analysis",
        "description": "Create a 5 students x 4 subjects marks matrix. Print each student's average, each subject's average, the topper, and students failing any subject.",
        "due": "2026-12-08T23:59",
        "active": true
      },
      {
        "id": "a15-data",
        "dayId": "d15-data",
        "track": "data",
        "title": "Explore a CSV",
        "description": "Load any CSV from the Materials folder. Print its shape, column types, summary stats, top 5 rows by one column, and answer 3 questions about it.",
        "due": "2026-12-09T23:59",
        "active": true
      },
      {
        "id": "a16-data",
        "dayId": "d16-data",
        "track": "data",
        "title": "Clean a messy dataset",
        "description": "Clean the messy dataset from Materials: fix types, handle missing values, remove duplicates, standardise text. Save the clean file and list what you changed.",
        "due": "2026-12-10T23:59",
        "active": true
      },
      {
        "id": "a17-data",
        "dayId": "d17-data",
        "track": "data",
        "title": "Sales by region & month",
        "description": "Using sales + regions files, produce total and average sales by region and by month, and the top product per region.",
        "due": "2026-12-11T23:59",
        "active": true
      },
      {
        "id": "a18-data",
        "dayId": "d18-data",
        "track": "data",
        "title": "Chart pack",
        "description": "Create 4 charts from your cleaned data (trend, comparison, distribution, relationship). Save them as PNG and write one insight per chart in comments.",
        "due": "2026-12-14T23:59",
        "active": true
      },
      {
        "id": "a19-data",
        "dayId": "d19-data",
        "track": "data",
        "title": "Automated summary report",
        "description": "Write a script that reads a raw Excel file and writes a summary Excel with 3 sheets: clean data, summary tables, and key numbers.",
        "due": "2026-12-15T23:59",
        "active": true
      },
      {
        "id": "a20-data",
        "dayId": "d20-data",
        "track": "data",
        "title": "Capstone: data analysis project",
        "description": "Submit your capstone notebook/script with charts and a short findings summary in comments.",
        "due": "2026-12-17T09:00",
        "active": true
      },
      {
        "id": "a13-web",
        "dayId": "d13-web",
        "track": "web",
        "title": "Hello Flask",
        "description": "Flask app with routes `/`, `/about` and `/hello/<name>` that returns a personal greeting.",
        "due": "2026-12-07T23:59",
        "active": true
      },
      {
        "id": "a14-web",
        "dayId": "d14-web",
        "track": "web",
        "title": "Personal profile page",
        "description": "Build a profile page with a header, about section, skills list and a contact form. Paste the HTML (with CSS in a <style> tag).",
        "due": "2026-12-08T23:59",
        "active": true
      },
      {
        "id": "a15-web",
        "dayId": "d15-web",
        "track": "web",
        "title": "Multi-page Flask site",
        "description": "3-page Flask site using a base template. One page lists items from a Python list.",
        "due": "2026-12-09T23:59",
        "active": true
      },
      {
        "id": "a16-web",
        "dayId": "d16-web",
        "track": "web",
        "title": "Feedback form app",
        "description": "Form with name, email, rating and message. Validate inputs, store submissions in a list, and show them on a /feedback page.",
        "due": "2026-12-10T23:59",
        "active": true
      },
      {
        "id": "a17-web",
        "dayId": "d17-web",
        "track": "web",
        "title": "Notes app (JSON)",
        "description": "Flask notes app: create, list and delete notes. Use a Note class and store notes in a JSON file.",
        "due": "2026-12-11T23:59",
        "active": true
      },
      {
        "id": "a18-web",
        "dayId": "d18-web",
        "track": "web",
        "title": "Notes app on SQLite",
        "description": "Move your notes app from JSON to SQLite, and add editing a note.",
        "due": "2026-12-14T23:59",
        "active": true
      },
      {
        "id": "a19-web",
        "dayId": "d19-web",
        "track": "web",
        "title": "Polish & deploy",
        "description": "Polish your notes app (styling, 404 page, messages). Submit your main app file and, if deployed, the live link in a comment.",
        "due": "2026-12-15T23:59",
        "active": true
      },
      {
        "id": "a20-web",
        "dayId": "d20-web",
        "track": "web",
        "title": "Capstone: web app",
        "description": "Submit your main app.py (and templates pasted below it). Explain features in comments.",
        "due": "2026-12-17T09:00",
        "active": true
      },
      {
        "id": "a13-auto",
        "dayId": "d13-auto",
        "track": "auto",
        "title": "Folder inspector",
        "description": "Script that takes a folder path and prints the number of files, total size, and a count of files per extension.",
        "due": "2026-12-07T23:59",
        "active": true
      },
      {
        "id": "a14-auto",
        "dayId": "d14-auto",
        "track": "auto",
        "title": "Downloads organiser",
        "description": "Script that moves files into Images/Docs/Code/Others folders by extension. Include a dry-run mode that only prints what it would do.",
        "due": "2026-12-08T23:59",
        "active": true
      },
      {
        "id": "a15-auto",
        "dayId": "d15-auto",
        "track": "auto",
        "title": "Merge monthly sheets",
        "description": "Merge 3 monthly CSV/Excel files from Materials into one file with a total row, and write it to a new Excel file.",
        "due": "2026-12-09T23:59",
        "active": true
      },
      {
        "id": "a16-auto",
        "dayId": "d16-auto",
        "track": "auto",
        "title": "Contact extractor",
        "description": "Read a messy text file and extract all emails and 10-digit phone numbers into a clean CSV.",
        "due": "2026-12-10T23:59",
        "active": true
      },
      {
        "id": "a17-auto",
        "dayId": "d17-auto",
        "track": "auto",
        "title": "API fetcher",
        "description": "Call a free public API (weather, currency or quotes), print a clean summary and save the results to CSV. Handle network errors.",
        "due": "2026-12-11T23:59",
        "active": true
      },
      {
        "id": "a18-auto",
        "dayId": "d18-auto",
        "track": "auto",
        "title": "Quote scraper",
        "description": "Scrape all quotes, authors and tags from quotes.toscrape.com (all pages) into a CSV.",
        "due": "2026-12-14T23:59",
        "active": true
      },
      {
        "id": "a19-auto",
        "dayId": "d19-auto",
        "track": "auto",
        "title": "CLI tool",
        "description": "Convert your Downloads organiser into a CLI with arguments (folder, --dry-run, --verbose) and logging to a file.",
        "due": "2026-12-15T23:59",
        "active": true
      },
      {
        "id": "a20-auto",
        "dayId": "d20-auto",
        "track": "auto",
        "title": "Capstone: automation tool",
        "description": "Submit your automation script with a comment block explaining the problem, how to run it, and the time it saves.",
        "due": "2026-12-17T09:00",
        "active": true
      },
      {
        "id": "a13-ai",
        "dayId": "d13-ai",
        "track": "ai",
        "title": "NumPy warm-up",
        "description": "Generate 100 random exam scores, compute mean, median, standard deviation, and the count above 75.",
        "due": "2026-12-07T23:59",
        "active": true
      },
      {
        "id": "a14-ai",
        "dayId": "d14-ai",
        "track": "ai",
        "title": "Dataset exploration",
        "description": "Load the Titanic dataset, clean it (missing ages, categorical columns) and print survival rate by class and gender.",
        "due": "2026-12-08T23:59",
        "active": true
      },
      {
        "id": "a15-ai",
        "dayId": "d15-ai",
        "track": "ai",
        "title": "Find patterns visually",
        "description": "Make 3 charts from Iris or Titanic and write what pattern each shows.",
        "due": "2026-12-09T23:59",
        "active": true
      },
      {
        "id": "a16-ai",
        "dayId": "d16-ai",
        "track": "ai",
        "title": "Split & baseline",
        "description": "Split a dataset 80/20 and build a baseline (predict the most common class or the mean). Report its score.",
        "due": "2026-12-10T23:59",
        "active": true
      },
      {
        "id": "a17-ai",
        "dayId": "d17-ai",
        "track": "ai",
        "title": "Study hours → marks",
        "description": "Train a linear regression to predict marks from study hours (data in Materials). Print the equation, MAE, R² and a prediction for 6 hours.",
        "due": "2026-12-11T23:59",
        "active": true
      },
      {
        "id": "a18-ai",
        "dayId": "d18-ai",
        "track": "ai",
        "title": "Iris classifier",
        "description": "Train KNN and a decision tree on Iris. Print accuracy for both and predict 3 new flowers.",
        "due": "2026-12-14T23:59",
        "active": true
      },
      {
        "id": "a19-ai",
        "dayId": "d19-ai",
        "track": "ai",
        "title": "Compare 3 models",
        "description": "Compare 3 classifiers on Titanic using cross-validation, print a confusion matrix for the best one, and save it with joblib.",
        "due": "2026-12-15T23:59",
        "active": true
      },
      {
        "id": "a20-ai",
        "dayId": "d20-ai",
        "track": "ai",
        "title": "Capstone: ML project",
        "description": "Submit your notebook/script: data prep, model, evaluation and a short conclusion in comments.",
        "due": "2026-12-17T09:00",
        "active": true
      }
    ]
  };
}
