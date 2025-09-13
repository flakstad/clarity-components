/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Mock SortableJS
global.Sortable = {
  create: jest.fn(() => ({
    destroy: jest.fn()
  }))
};

describe('Drag and Drop Feature', () => {
  let container;

  beforeEach(() => {
    // Load the web component
    const outlinePath = path.join(process.cwd(), 'outline.js');
    const outlineCode = fs.readFileSync(outlinePath, 'utf8');
    
    // Temporarily override customElements.define to prevent registration errors
    const originalDefine = customElements.define;
    customElements.define = (name, constructor) => {
      try {
        originalDefine.call(customElements, name, constructor);
      } catch (error) {
        // Ignore "already registered" errors
        if (!error.message.includes('already been registered')) {
          throw error;
        }
      }
    };
    
    // Evaluate the code in the current context
    eval(outlineCode);
    
    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    jest.clearAllMocks();
  });

  test('should have dragAndDrop feature disabled by default', () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    const outlineInstance = outline.todoListInstance;
    
    expect(outlineInstance.options.features.dragAndDrop).toBe(false);
  });

  test('should enable dragAndDrop feature when configured', () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    const outlineInstance = outline.todoListInstance;
    
    expect(outlineInstance.options.features.dragAndDrop).toBe(true);
  });

  test('should add drag handles when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"First item","status":"TODO"},
          {"id":"2","text":"Second item","status":"TODO"}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(2);
    
    // Check drag handle properties
    const firstHandle = dragHandles[0];
    expect(firstHandle.innerHTML).toBe('⋮⋮');
    expect(firstHandle.title).toBe('Drag to reorder');
  });

  test('should not add drag handles when dragAndDrop is disabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"First item","status":"TODO"},
          {"id":"2","text":"Second item","status":"TODO"}
        ]'
        data-features='{"dragAndDrop": false}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(0);
  });

  test('should initialize Sortable when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(global.Sortable.create).toHaveBeenCalled();
    
    const sortableCall = global.Sortable.create.mock.calls[0];
    const [element, options] = sortableCall;
    
    expect(options.handle).toBe('.drag-handle');
    expect(options.animation).toBe(150);
    expect(options.ghostClass).toBe('sortable-ghost');
    expect(options.chosenClass).toBe('sortable-chosen');
    expect(options.dragClass).toBe('sortable-drag');
    expect(typeof options.onEnd).toBe('function');
  });

  test('should emit outline:move event when drag ends', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"First item","status":"TODO"},
          {"id":"2","text":"Second item","status":"TODO"}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    let moveEvent = null;
    
    outline.addEventListener('outline:move', (e) => {
      moveEvent = e;
    });
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate drag end event
    const sortableCall = global.Sortable.create.mock.calls[0];
    const options = sortableCall[1];
    const mockDragEvent = {
      oldIndex: 0,
      newIndex: 1,
      item: outline.shadowRoot.querySelector('li')
    };
    
    options.onEnd(mockDragEvent);
    
    expect(moveEvent).not.toBeNull();
    expect(moveEvent.detail.oldIndex).toBe(0);
    expect(moveEvent.detail.newIndex).toBe(1);
    expect(moveEvent.detail.direction).toBe('down');
  });

  test('should not emit move event when item is not actually moved', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Test item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    let moveEvent = null;
    
    outline.addEventListener('outline:move', (e) => {
      moveEvent = e;
    });
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate drag end event with same position
    const sortableCall = global.Sortable.create.mock.calls[0];
    const options = sortableCall[1];
    const mockDragEvent = {
      oldIndex: 0,
      newIndex: 0,
      item: outline.shadowRoot.querySelector('li')
    };
    
    options.onEnd(mockDragEvent);
    
    expect(moveEvent).toBeNull();
  });

  test('should add drag handle to new items when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate adding a new item
    const outlineInstance = outline.todoListInstance;
    outlineInstance.createNewTodo();
    
    // Wait for the new item to be added
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(1);
  });

  test('should add drag handle to sibling items when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"First item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const outlineInstance = outline.todoListInstance;
    const firstLi = outline.shadowRoot.querySelector('li');
    
    // Simulate adding a sibling item (Alt+Enter functionality)
    outlineInstance.addSiblingTodo(firstLi);
    
    // Wait for the new item to be added
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(2); // Original item + new sibling
  });

  test('should add drag handle to child items when dragAndDrop is enabled', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{"id":"1","text":"Parent item","status":"TODO"}]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const outlineInstance = outline.todoListInstance;
    const parentLi = outline.shadowRoot.querySelector('li');
    
    // Simulate adding a child item
    outlineInstance.addItem("Child item", parentLi);
    
    // Wait for the new item to be added
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const dragHandles = outline.shadowRoot.querySelectorAll('.drag-handle');
    expect(dragHandles.length).toBe(2); // Parent item + new child
  });

  test('should initialize sortable on nested lists', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[{
          "id":"1",
          "text":"Parent item",
          "status":"TODO",
          "children":[{"id":"2","text":"Child item","status":"TODO"}]
        }]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have multiple sortable instances (main list + nested list)
    const outlineInstance = outline.todoListInstance;
    expect(outlineInstance.sortableInstances).toBeDefined();
    expect(outlineInstance.sortableInstances.length).toBeGreaterThan(1);
  });

  test('should emit hierarchical move events', async () => {
    container.innerHTML = `
      <clarity-outline
        data-items='[
          {"id":"1","text":"Item 1","status":"TODO"},
          {"id":"2","text":"Item 2","status":"TODO"}
        ]'
        data-features='{"dragAndDrop": true}'>
      </clarity-outline>
    `;

    const outline = container.querySelector('clarity-outline');
    let moveEvent = null;
    
    outline.addEventListener('outline:move', (e) => {
      moveEvent = e;
    });
    
    // Wait for component to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const outlineInstance = outline.todoListInstance;
    const mockFromList = outline.shadowRoot.querySelector('.outline-list');
    const mockToList = outline.shadowRoot.querySelector('.outline-list');
    
    // Simulate hierarchical drag end event
    const mockDragEvent = {
      item: outline.shadowRoot.querySelector('li'),
      from: mockFromList,
      to: mockToList,
      oldIndex: 0,
      newIndex: 1
    };
    
    outlineInstance.handleHierarchicalDragEnd(mockDragEvent);
    
    expect(moveEvent).not.toBeNull();
    expect(moveEvent.detail.moveType).toBe('reorder');
    expect(moveEvent.detail.fromList).toBeDefined();
    expect(moveEvent.detail.toList).toBeDefined();
  });

});
