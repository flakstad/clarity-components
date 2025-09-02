# Clarity Outline

A flexible, feature-rich outline component with keyboard navigation, metadata support, and web component integration.

## Features

- **Hierarchical Structure**: Create nested outlines with unlimited depth
- **Keyboard Navigation**: Full emacs and vi-style keyboard shortcuts
- **Metadata Support**: Priority, due dates, assignees, tags, notes, and more
- **Status Management**: Customizable status labels with completion tracking
- **Web Component**: Easy integration with any framework
- **Accessibility**: Full keyboard navigation and screen reader support

## Keyboard Navigation

### Navigation Shortcuts

#### Arrow Keys
- **↑/↓**: Navigate between sibling items
- **→**: Navigate into first child (expands if collapsed)
- **←**: Navigate to parent item

#### Emacs Style (Ctrl + key)
- **Ctrl + N**: Next item
- **Ctrl + P**: Previous item  
- **Ctrl + F**: Forward into children
- **Ctrl + B**: Back to parent

#### Vi Style
- **J**: Next item
- **K**: Previous item
- **L**: Forward into children
- **H**: Back to parent

### Item Movement Shortcuts

#### Arrow Keys with Alt
- **Alt + ↑**: Move item up in list
- **Alt + ↓**: Move item down in list
- **Alt + →**: Indent item (make it a child)
- **Alt + ←**: Outdent item (make it a sibling)

#### Emacs Style (Alt + key)
- **Alt + N**: Move item down
- **Alt + P**: Move item up
- **Alt + F**: Indent item
- **Alt + B**: Outdent item

#### Vi Style (Alt + key)
- **Alt + J**: Move item down
- **Alt + K**: Move item up
- **Alt + L**: Indent item
- **Alt + H**: Outdent item

### Other Shortcuts

- **E**: Edit item text
- **Double-click**: Edit item text
- **Enter**: Open item in solo view
- **Alt + Enter**: Add new sibling todo
- **Alt + T**: Toggle collapsed/expanded state (toggle hierarchy)
- **Shift + →**: Cycle status forward
- **Shift + ←**: Cycle status backward
- **Shift + ↑/↓**: Toggle priority
- **T**: Show tags popup
- **P**: Toggle priority
- **B**: Toggle blocked status
- **D**: Set due date
- **N**: Add notes
- **A**: Assign to user
- **R**: Remove item
- **S**: Change status
- **O**: Open solo view

## Quick Start

### HTML Usage

```html
<outline-list 
  data-assignees='["Alice", "Bob", "Charlie"]'
  data-tags='["urgent", "bug", "feature"]'
  data-status-labels='[{"label": "TODO", "isEndState": false}, {"label": "DONE", "isEndState": true}]'>
</outline-list>
```

### JavaScript Usage

```javascript
import { Outline } from './outline.js';

const outline = new Outline(document.querySelector('.outline-list'), {
  assignees: ['Alice', 'Bob', 'Charlie'],
  tags: ['urgent', 'bug', 'feature'],
  statusLabels: [
    { label: 'TODO', isEndState: false },
    { label: 'DONE', isEndState: true }
  ],
  features: {
    priority: true,
    blocked: true,
    dueDate: true,
    assign: true,
    tags: true,
    notes: true,
    remove: true
  }
});
```

## Configuration Options

### Status Labels
Customize the status labels and their completion states:

```javascript
statusLabels: [
  { label: 'TODO', isEndState: false },
  { label: 'IN PROGRESS', isEndState: false },
  { label: 'REVIEW', isEndState: false },
  { label: 'DONE', isEndState: true }
]
```

### Features
Enable or disable specific features:

```javascript
features: {
  priority: true,      // Show priority toggle
  blocked: true,       // Show blocked status
  dueDate: true,       // Show due date picker
  assign: true,        // Show assignee dropdown
  tags: true,          // Show tags management
  notes: true,         // Show notes editor
  remove: true         // Show remove button
}
```

## Events

The component emits various events for integration:

- `outline:select` - Item selected
- `outline:add` - New item added
- `outline:edit:save` - Item text edited
- `outline:move` - Item moved/reordered
- `outline:indent` - Item indented
- `outline:outdent` - Item outdented
- `outline:collapse` - Item collapsed
- `outline:expand` - Item expanded
- `outline:toggle` - Status changed
- `outline:priority` - Priority toggled
- `outline:blocked` - Blocked status toggled
- `outline:due` - Due date set/cleared
- `outline:assign` - Assignee set/cleared
- `outline:tags` - Tags updated
- `outline:notes` - Notes updated
- `outline:remove` - Item removed

## Examples

See the `examples.html` and `keyboard-navigation-demo.html` files for working examples.

## Browser Support

- Chrome 67+
- Firefox 63+
- Safari 11.1+
- Edge 79+

## License

MIT License
