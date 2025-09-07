# QLF - Query Language Filter

[![npm version](https://badge.fury.io/js/qlf.svg)](https://badge.fury.io/js/qlf)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**QLF** transforms text queries into ready-to-use filter functions for your data. Write human-readable queries like `status = "active" and role like "dev"` and get optimized JavaScript functions that work with arrays of objects. Built-in JQL-like syntax included, or create your own custom query language.

## 🚀 Features

- **Direct JavaScript Transpilation**: Queries compile to native JS functions for maximum performance
- **Built-in Safety**: Guards prevent runtime errors from undefined/null properties
- **Nested Property Access**: Query deep object structures without complex syntax
- **Custom Query Languages**: Create your own DSL with custom grammars and lexemes
- **JavaScript Integration**: Use calculations, built-in functions, and complex expressions in queries
- **Type Safe**: Full TypeScript support with comprehensive type definitions
- **Zero Dependencies**: Lightweight and self-contained

## 📦 Installation

```bash
npm install qlf
# or
yarn add qlf
```

## 🔥 Quick Start

```typescript
import { QLF } from 'qlf'

// Create QLF instance
const qlf = new QLF()

// Your data
const data = [
  { name: 'John', status: 'active', role: 'developer', score: 85 },
  { name: 'Jane', status: 'inactive', role: 'designer', score: 92 },
  { name: 'Bob', status: 'active', role: 'manager', score: 78 }
]

// Queries transpile to JavaScript - you can use calculations and JS functions!
const filterFn = qlf.transpile('status = "active" and score > 80 and role.length > 5').filter

// Filter your data
const result = data.filter(filterFn)
// Result: [{ name: 'John', status: 'active', role: 'developer', score: 85 }]
```

## 📖 Query Syntax

QLF uses operators to compare properties with values, check membership in lists, and perform text matching. Each operator translates to optimized JavaScript code.

### Basic Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `=` | `name = "John"` | Equality |
| `!=` | `status != "inactive"` | Inequality |
| `!` | `!(status = "active")` | Logical negation (works with any expression) |
| `like` | `name like "Jo"` | Regex match |
| `not like` | `role not like "admin"` | Negative regex match |
| `in` | `status in ("active", "pending")` | List inclusion |
| `not in` | `role not in ("admin", "guest")` | List exclusion |
| `is null` | `description is null` | Null check |
| `is not null` | `email is not null` | Not null check |
| `is empty` | `comment is empty` | Empty string check |
| `starts with` | `name starts with "J"` | String prefix |
| `ends with` | `email ends with ".com"` | String suffix |

### Logical Operators

```typescript
// AND (case insensitive)
status = "active" AND role = "developer"
status = "active" and role = "developer"
status = "active" && role = "developer"

// OR (case insensitive)
role = "admin" OR role = "moderator"
role = "admin" or role = "moderator"
role = "admin" || role = "moderator"

// Complex combinations
(status = "active" and role like "dev") or priority in ("high", "critical")
```

### Array Operations

Special syntax for working with array properties in your data. These operations allow you to search within arrays without writing complex JavaScript array methods.

```typescript
// For array properties
const data = [
  { user: 'john', tags: ['frontend', 'react'] },
  { user: 'jane', tags: ['backend', 'node'] }
]

// Check if array contains value
qlf.transpile('tags has "react"').filter

// Check if array contains any of values
qlf.transpile('tags has one of ("react", "vue")').filter

// Check if array contains all values
qlf.transpile('tags has all of ("frontend", "react")').filter
```

## ⚙️ Configuration

### Basic Settings

Configure QLF behavior with these core options. These settings control how queries are parsed, executed, and what kind of JavaScript code is generated.

```typescript
const qlf = new QLF({
  caseSensitive: false,    // Case sensitive regex matching
  strictEquality: true,    // Use === instead of ==
  strictFilter: false,     // Enable performance optimizations
  filterOnly: false,       // Return only filter function
  nodeName: 'node'         // Variable name in generated code
})
```

### Custom Functions

Extend query capabilities by adding custom functions that can be called within queries. These functions are executed at filter time and can access external data or perform calculations.

```typescript
const qlf = new QLF({}, {
  functions: {
    currentUser: () => getCurrentUser().id,
    today: () => new Date().toISOString().split('T')[0],
    openSprints: () => ['SPRINT-1', 'SPRINT-2'],
    isWeekend: () => [0, 6].includes(new Date().getDay())
  }
})

// Use in queries
const filterFn = qlf.transpile('assignee = currentUser() and sprint in openSprints()').filter
```

### Working with Nested Data

Handle complex object structures by specifying the path to the data you want to query. This allows filtering on deeply nested properties without complex syntax in your queries.


```typescript
const data = [
  {
    user: { profile: { name: 'John', settings: { theme: 'dark' } } },
    tasks: [{ priority: 'high', completed: false }]
  }
]

// Configure path to nested object
const qlf = new QLF({
  nodeName: 'item.user.profile'
})

// Query nested properties
const filterFn = qlf.transpile('name = "John"').filter
// Will match item.user.profile.name === "John"
```

## 🛠️ Advanced Usage

### Lexemes

Lexemes are the building blocks of queries - they define what patterns QLF recognizes as keys, values, lists, etc. **Each lexeme can only appear once per grammar** due to regex named group limitations.

**Standard Lexemes:**

| Lexeme | Pattern | Description |
|--------|---------|-------------|
| `key` | `[\w.]+` | Object property names (foo, user.name) |
| `value` | `[\w-]+` | Values for comparison |
| `list` | `\([^)]+\)` | Parentheses-wrapped value lists ("a", "b", "c") |

**Custom Lexemes:**

```typescript
const qlf = new QLF({}, {
  lexemes: {
    date: /(?<date>\d{4}-\d{2}-\d{2})/,     // ISO date format
    number: /(?<number>\d+(\.\d+)?)/,       // Integer or decimal numbers
    minVal: /(?<minVal>\d+)/,               // Range minimum value
    maxVal: /(?<maxVal>\d+)/,               // Range maximum value
    email: /(?<email>[\w.-]+@[\w.-]+)/      // Email addresses
  }
})

// ❌ Won't work: 'key between value and value' (duplicate 'value')
// ✅ Works: 'key between minVal and maxVal' (unique names)
```

### Grammars

Grammars define the syntax patterns that QLF can understand and how they should be translated to JavaScript code. This is how you create your own query language!

**Standard Grammars:**

| Key Type | Grammar | Negative | Description |
|-----|---------|----------|-------------|
| Any | `key is null` | `key is not null` | Null/undefined checking |
| Any | `key in list` | `key not in list` | Check if property value exists in list |
| String | `key like value` | `key not like value` | Regex pattern matching |
| String | `key contains value` | `key not contains value` | Substring search (same as like) |
| String | `key starts with value` | `key not starts with value` | String prefix matching |
| String | `key ends with value` | `key not ends with value` | String suffix matching |
| String | `key is empty` | `key is not empty` | Check for empty string |
| Array | `key has value` | | Check if array property contains specific value |
| Array | `key has one of list` | | Check if array contains any of the listed values |
| Array | `key has all of list` | | Check if array contains all of the listed values |

**Custom Grammars:**
```typescript
const qlf = new QLF({}, {
  lexemes: {
    minVal: /(?<minVal>\w+)/,
    maxVal: /(?<maxVal>\w+)/
  },
  grammars: {
    'key between minVal && maxVal': {  // Use && since 'and' gets replaced
      code: 'key >= minVal && key <= maxVal',
      guards: {
        key: Guards.commonGuard,
        minVal: (v) => Guards.safeVariable(v),
        maxVal: (v) => Guards.safeVariable(v)
      }
    },
    'key within distance from value': {
      code: 'Math.abs(key - value) <= distance',
      guards: {
        key: Guards.commonGuard,
        value: (v) => Number(v),
        distance: (v) => Number(v)
      }
    }
  }
})

// Usage: age between 18 and 65, score within 10 from 85
```

### Synonyms

Synonyms automatically replace operators and keywords in queries before grammar processing. They enable natural language alternatives to programming operators.

**Standard Synonyms:**

| Synonym | Replacement | Description |
|---------|-------------|-------------|
| `AND` (case-insensitive) | `&&` | Logical AND operator |
| `OR` (case-insensitive) | <code>&#124;&#124;</code> | Logical OR operator |
| `~` | `contains` | Shorthand for contains |
| `!~` | `not contains` | Shorthand for not contains |
| `=` (multiple) | `==` | Equality normalization |

**Custom Synonyms:**
```typescript
const qlf = new QLF({}, {
  synonyms: new Map([
    [/\bis\s+like\b/gi, 'like'],           // "is like" → "like"
    [/\bequals?\b/gi, '=='],               // "equals" → "=="
    [/\bmatches?\b/gi, 'like'],            // "matches" → "like"
    [/\bdoesn'?t\s+contain\b/gi, 'not contains'], // "doesn't contain" → "not contains"
    [/[≥≧]/g, '>='],                       // Unicode greater-equal
    [/[≤≦]/g, '<=']                        // Unicode less-equal
  ])
})

// Usage: "status equals active", "name doesn't contain test", "age ≥ 21"
```

### Guards

Guards are safety functions that protect lexeme values from runtime errors. They transform raw lexeme values into safe JavaScript code before they're inserted into the generated code.

```typescript
import { Guards } from 'qlf/guards'

const qlf = new QLF({}, {
  grammars: {
    'key equals value': {
      code: 'key == value',
      guards: {
        key: Guards.commonGuard,        // Protects property access
        value: Guards.safeVariable,     // Handles undefined variables
        code: Guards.quote              // Custom code transformation
      }
    }
  }
})

// Query: 'user.name equals undefined'
// Without guards: user.name == undefined (may throw if user is null)
// With guards: (typeof user === 'undefined' ? 'user' : user)?.['name'] == undefined
```

**Built-in Guards:**
- `commonGuard`: Safe property access with optional chaining
- `safeVariable`: Handles undefined variables gracefully
- `safeArrayName`: Protects array method calls
- `safeList`: Guards comma-separated value lists
- `quote/unquote`: String quotation handling

**Custom Guards:**
```typescript
const customGuards = {
  numberOnly: (value) => Number(value) || 0,
  upperCase: (value) => value.toUpperCase(),
  sqlEscape: (value) => value.replace(/'/g, "''")
}
```

### Strict vs Sloppy Mode

Two different execution modes that balance ease of use vs performance. Sloppy mode uses JavaScript's `with` statement for simpler property access but is slower. Strict mode generates more optimized functions with caching.

```typescript
// Sloppy mode (default) - uses 'with' statement for easy property access
const sloppyQLF = new QLF({ strictFilter: false })

// Strict mode - better performance with caching, no 'with' statement
const strictQLF = new QLF({ strictFilter: true })
```

## 🎯 Real-world Examples

### Issue Tracking System (JQL-like)

Perfect for building Jira-like query interfaces. Shows how to integrate dynamic functions that fetch current user context and system state.

```typescript
const issueQLF = new QLF({}, {
  functions: {
    currentUser: () => getCurrentUser().email,
    openSprints: () => getActiveSprints(),
    myProjects: () => getUserProjects()
  }
})

const queries = [
  'project = "WEBAPP" and status in ("To Do", "In Progress")',
  'assignee = currentUser() and priority = "High"',
  'sprint in openSprints() and project in myProjects()',
  'created >= "2024-01-01" and labels has "bug"'
]
```

### E-commerce Product Filtering

Ideal for building advanced product search and filtering. Demonstrates custom functions for business logic, complex calculations, and JavaScript integration.

```typescript
const productQLF = new QLF({}, {
  functions: {
    inStock: () => true, // Simple availability check
    onSale: () => new Date().getDay() === 5, // Friday sales
    currentSeason: () => 'winter'
  },
  grammars: {
    'key between value and value': {
      code: 'key >= value1 && key <= value2',
      guards: {
        value1: (v) => v,
        value2: (v) => v
      }
    }
  }
})

const productQueries = [
  'price between 100 and 500 and inStock()', // Custom range + function
  'brand in ("Apple", "Samsung") and rating >= 4.0', // List check + comparison
  'tags has "bestseller" and onSale()', // Array operation + custom function
  'name.toLowerCase() like "iphone" and price < 1000', // JS method + comparison
  'category = currentSeason() and inventory > Math.floor(rating * 10)' // Function + calculation
]
```

### User Management

Great for admin panels and user dashboards. Shows nested data access and role-based filtering patterns.

```typescript
const userQLF = new QLF({
  nodeName: 'user.profile'
})

const userQueries = [
  'status = "active" and role not in ("guest", "banned")', // Status + role exclusion
  'email like "@company.com" and department = "engineering"', // Email pattern + exact match
  'lastLogin >= "2024-01-01" and permissions has "admin"', // Date comparison + array search
  'profile.settings.theme = "dark" and profile.age > 18', // Deep nesting + calculation
  'createdAt.getFullYear() = 2024 and profile.name.length > 3' // JS method + property access
]
```

## 🐛 Error Handling

QLF provides comprehensive error handling for both compile-time syntax errors and runtime execution issues. Always check for errors before using the generated filter functions.

```typescript
try {
  const result = qlf.transpile('invalid query syntax')
  if (result.error) {
    console.error('Query error:', result.error)
  }
} catch (error) {
  console.error('Transpilation failed:', error.message)
}
```

## 📊 Performance

Choose the right mode based on your performance needs. QLF is designed to be lightweight and fast regardless of your data size.

- **Sloppy Mode**: Fast compilation, uses JavaScript's `with` statement
- **Strict Mode**: Optimized runtime with function caching based on object keys
- **Memory Efficient**: Minimal overhead, no heavy dependencies

## 🚧 Roadmap

Currently, QLF implements only the **filter** functionality from the `transpile()` result. Future development plans include:

- **Sorter**: `ORDER BY` clause support for sorting filtered results
- **Query**: Combined filter + sort functionality for complete data processing
- **Error Handling**: Comprehensive error reporting with position information
- **Meta Information**: Query analysis and suggestions:
  - `underCursor.grammar`: Detected grammar pattern at cursor position
  - `underCursor.key/value/list`: Current lexeme type for intelligent suggestions
  - `parts`: Parsed query structure for advanced tooling

These features will enable building rich query editors, autocomplete, and debugging tools on top of QLF.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/Liksu/qlf)
- [Issues](https://github.com/Liksu/qlf/issues)
- [Changelog](https://github.com/Liksu/qlf/releases)

---

**Made with ❤️ by [Petro Borshchahivskyi](https://github.com/Liksu)**