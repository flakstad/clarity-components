# Clarity Components

A collection of flexible, feature-rich components for task management and organization, including outline and capture components with keyboard navigation and web component integration.

## Outline Component

Hierarchical task management with full keyboard navigation, metadata support, and customizable workflows.

### Key Features
- Unlimited nesting depth with expand/collapse
- Full keyboard navigation (emacs, vi, and arrow key styles)
- Rich metadata: priority, due dates, assignees, tags, comments, worklog
- Customizable status workflows
- Web component integration

## Capture Component

Org-mode inspired quick capture interface for rapid task entry with template support.

### Key Features
- Template-based capture workflows
- Keyboard-driven interface
- Hierarchical template organization
- Quick task creation and categorization

## Quick Start

### Outline Component
```html
<clarity-outline 
  data-assignees='["alice", "bob", "charlie"]'
  data-tags='["urgent", "bug", "feature"]'
  data-items='[
    {
      "id": "1",
      "text": "Sample task",
      "status": "TODO",
      "priority": false
    }
  ]'>
</clarity-outline>
```

### Capture Component
```html
<clarity-capture 
  data-templates='[
    {
      "id": "todo",
      "name": "Todo Item",
      "shortcut": "t",
      "description": "Add a new task to your todo list"
    }
  ]'>
</clarity-capture>
```


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

### Mouse Interactions

- **Single click**: Select/focus item
- **Double-click**: Edit item text
- **Ctrl/Cmd + click**: Open item in solo view

### Other Shortcuts

- **E**: Edit item text
- **Enter**: Open item in solo view
- **Alt + Enter**: Add new sibling todo
- **Alt + T**: Toggle collapsed/expanded state (toggle hierarchy)
- **Shift + →**: Cycle status forward
- **Shift + ←**: Cycle status backward
- **Shift + ↑/↓**: Toggle priority
- **T**: Show tags popup
- **P**: Toggle priority
- **H**: Toggle on hold status
- **D**: Set due date (with optional time)
- **S**: Set schedule date (with optional time)
- **C**: Add comment (public discussion)
- **W**: Add worklog entry (private notes)
- **A**: Assign to user
- **R** or **Del**: Archive item
- **Space**: Change status
- **O**: Open solo view

## JavaScript API

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
    onHold: true,
    due: true,
    schedule: true,
    assign: true,
    tags: true,
    notes: true,
    archive: true
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
  onHold: true,         // Show on hold status
  due: true,           // Show due date picker
  schedule: true,      // Show schedule date picker
  assign: true,        // Show assignee dropdown
  tags: true,          // Show tags management
  comments: true,      // Show comments (public discussion)
  worklog: true,       // Show worklog (private notes)
  remove: true         // Show archive button
}
```

## Date and Time Setting

Both due dates and schedule dates support optional time setting with appropriate friction to encourage date-only usage as the primary workflow.

### Setting Dates
- Press **D** for due dates or **C** for schedule dates
- Select a date using the date picker
- Click "Set Date" to save with date only

### Adding Time (Optional)
- After selecting a date, click the "Add time" button next to the date input
- This switches the input to a datetime picker allowing both date and time selection
- Times default to 9:00 AM when first adding time
- Click the "Only date" button to remove time and return to date-only

### Time Display
- Dates without time: "Jan 5"
- Dates with time: "Jan 5 14:30"
- Midnight times (00:00) are displayed when explicitly set
- Times are shown in 24-hour format (HH:MM)

## Comments and Worklog

The outline component supports two types of notes for each task:

### Comments (Public Discussion)
- **Purpose**: Public discussion thread visible to all team members
- **Keyboard shortcut**: **C**
- **Data structure**: Array of comment objects with `id`, `text`, `author`, and `timestamp`
- **Event**: `outline:comment` - emitted when a new comment is added

### Worklog (Private Notes)
- **Purpose**: Private work tracking visible only to the current user
- **Keyboard shortcut**: **W**
- **Data structure**: Array of worklog objects with `id`, `text`, `author`, and `timestamp`
- **Event**: `outline:worklog` - emitted when a new worklog entry is added
- **Privacy**: Users can only see their own worklog entries

### Usage Example

```javascript
// Listen for new comments and worklog entries
outline.addEventListener('outline:comment', (e) => {
  console.log('New comment:', e.detail.comment);
  console.log('All comments:', e.detail.allComments);
});

outline.addEventListener('outline:worklog', (e) => {
  console.log('New worklog entry:', e.detail.worklogEntry);
  console.log('All worklog entries:', e.detail.allWorklog);
});
```

### Data Structure

```javascript
{
  id: "task-id",
  text: "Task description",
  comments: [
    {
      id: "comment-id",
      text: "Comment text",
      author: "user-id",
      timestamp: "2024-01-15T10:30:00Z"
    }
  ],
  worklog: [
    {
      id: "worklog-id", 
      text: "Worklog entry",
      author: "user-id",
      timestamp: "2024-01-15T10:30:00Z"
    }
  ]
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
- `outline:on-hold` - On hold status toggled
- `outline:due` - Due date set/cleared (includes timestamp in ISO format)
- `outline:schedule` - Schedule date set/cleared (includes timestamp in ISO format)
- `outline:assign` - Assignee set/cleared
- `outline:tags` - Tags updated
- `outline:notes` - Notes updated
- `outline:archive` - Item archived

## Examples

See the `examples.html` and `keyboard-navigation-demo.html` files for working examples.

## Browser Support

- Chrome 67+
- Firefox 63+
- Safari 11.1+
- Edge 79+

## License

MIT License
