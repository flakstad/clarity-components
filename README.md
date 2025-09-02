# Clarity Outline

A powerful, keyboard-driven outline component built as a modern web component with embedded styling. Inspired by Emacs org-mode, now you can have the same powerful outline functionality in your web applications.

## Features

- **Keyboard Navigation**: Full keyboard support with arrow keys, shortcuts, and accessibility
- **Rich Metadata**: Support for assignees, tags, due dates, priority, and status
- **Hierarchical Structure**: Nested todos with indentation and collapse/expand
- **Web Component**: Modern web component with embedded styling
- **Theme Support**: Built-in light/dark theme with CSS custom properties
- **Event-Driven**: Comprehensive event system for integration
- **Smart Hover Behavior**: Hover buttons appear with a 1000ms delay and disappear immediately on unfocus

## Quick Start

```html
<script src="outline.js"></script>

<clarity-outline 
  data-items='[{"id":"1","text":"Buy groceries","status":"TODO"},{"id":"2","text":"Review code","status":"DONE"}]'>
</clarity-outline>
```

No CSS file needed.

## Usage

### Basic Usage

```html
<clarity-outline 
  data-items='[{"id":"1","text":"Buy groceries","status":"TODO"},{"id":"2","text":"Review code","status":"DONE"}]'
  options='{"assignees": ["alice", "bob", "charlie"], "tags": ["urgent", "bug", "feature"]}'>
</clarity-outline>
```

### Outline Item Data Structure

```javascript
{
  "id": "string",           // Required: Unique identifier
  "text": "string",         // Required: Outline text content
  "status": "string",       // Optional: Status label (TODO, DONE, etc.)
  "completed": boolean,     // Optional: Alternative to status for completion
  "priority": boolean,      // Optional: Mark as priority
          "blocked": boolean,        // Optional: Mark as blocked
  "schedule": "string",     // Optional: Due date (e.g., "Jan 5")
  "assign": "string",       // Optional: Assigned user
  "tags": ["string"],       // Optional: Array of tags
  "children": [outlineItem], // Optional: Nested outline items
  "classes": "string"       // Optional: Additional CSS classes
}
```

### Configuration Options

```javascript
{
  assignees: ['alice', 'bob', 'charlie'],           // Available assignees
  tags: ['urgent', 'bug', 'feature', 'docs'],       // Available tags
  statusLabels: [                                   // Custom status labels
    { label: 'TODO', isEndState: false },
    { label: 'IN PROGRESS', isEndState: false },
    { label: 'DONE', isEndState: true }
  ],
  features: {                                       // Enable/disable features
    priority: true,
    blocked: true,
    dueDate: true,
    assign: true,
    tags: true,
    notes: true,
    remove: true
  }
}
```

## Keyboard Shortcuts

### Navigation
- **Arrow Keys**: Navigate between items
- **Ctrl+N/P**: Navigate down/up (Emacs style)
- **J/K**: Navigate down/up (Vi style)
- **H/L**: Navigate left/right (Vi style)
- **Tab**: Navigate between items (browser default)

### Actions
- **Enter**: Navigate to detail view
- **Alt+Enter**: Create sibling outline item
- **E**: Enter edit mode
- **S**: Change status
- **O**: Open detail view
- **T**: Toggle tags
- **A**: Assign to user
- **D**: Set due date
- **N**: Add notes
- **R**: Remove item
- **P**: Toggle priority
- **B**: Toggle blocked
- **Shift+Arrow**: Cycle through statuses
- **Alt+Arrow**: Reorder items
- **Alt+Tab**: Toggle collapse/expand

## Events

```javascript
element.addEventListener("outline:add", (e) => {
  console.log("Outline item added:", e.detail);
});

element.addEventListener("outline:toggle", (e) => {
  console.log("Outline item toggled:", e.detail);
});
```

Available events: `outline:add`, `outline:toggle`, `outline:move`, `outline:edit:save`, `outline:due`, `outline:assign`, `outline:tags`, `outline:priority`, `outline:blocked`, `outline:navigate`, `outline:notes`, `outline:remove`

## JavaScript API

```javascript
const webComponent = document.querySelector("clarity-outline");

// Add outline item
webComponent.addItem("New outline item");

// Update outline items
webComponent.setTodos([
  { id: "1", text: "Updated outline item", status: "TODO" }
]);

// Get current outline items
const currentItems = webComponent.getTodos();
```

## Theming

The component uses CSS custom properties for theming:

```css
clarity-outline {
  --clarity-outline-spacing: 0.5rem;
  --clarity-outline-padding: 0.75rem;
  --clarity-outline-font-size: 16px;
  --clarity-outline-color-todo: #d16d7a;
  --clarity-outline-color-done: #6c757d;
}
```

## Examples

See `examples.html` for complete examples with different themes and customization options.

## License

MIT License
