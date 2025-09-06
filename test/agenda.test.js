/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Make classes available globally
let Agenda, AgendaElement;

describe('Agenda Component', () => {
  let container;
  let agenda;

  beforeEach(() => {
    // Load the agenda component
    const agendaPath = path.join(process.cwd(), 'agenda.js');
    const agendaCode = fs.readFileSync(agendaPath, 'utf8');
    
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
    eval(agendaCode);
    
    // Restore original customElements.define
    customElements.define = originalDefine;
    
    // Make classes available (they should be global after eval)
    if (typeof window !== 'undefined' && window.Agenda) {
      Agenda = window.Agenda;
      AgendaElement = window.AgendaElement;
    }
    
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Initialization', () => {
    test('should create agenda with default options', () => {
      agenda = new Agenda(container);
      
      expect(agenda.el).toBe(container);
      expect(agenda.options.view).toBe('week');
      expect(agenda.options.tasks).toEqual([]);
      expect(agenda.options.statusLabels).toEqual([
        { label: 'TODO', isEndState: false },
        { label: 'DONE', isEndState: true }
      ]);
    });

    test('should create agenda with custom options', () => {
      const options = {
        view: 'day',
        tasks: [{ id: '1', text: 'Test task', status: 'TODO' }],
        assignees: ['Alice', 'Bob'],
        tags: ['urgent', 'bug']
      };
      
      agenda = new Agenda(container, options);
      
      expect(agenda.options.view).toBe('day');
      expect(agenda.options.tasks).toEqual(options.tasks);
      expect(agenda.options.assignees).toEqual(options.assignees);
      expect(agenda.options.tags).toEqual(options.tags);
    });
  });

  describe('Date Utilities', () => {
    beforeEach(() => {
      agenda = new Agenda(container);
    });

    test('should get start of week correctly', () => {
      const date = new Date('2024-01-10'); // Wednesday
      const startOfWeek = agenda.getStartOfWeek(date);
      
      expect(startOfWeek.getDay()).toBe(1); // Monday
      expect(startOfWeek.getDate()).toBe(8); // January 8, 2024 (Monday)
    });

    test('should get week days correctly', () => {
      const startOfWeek = new Date('2024-01-08'); // Monday
      const weekDays = agenda.getWeekDays(startOfWeek);
      
      expect(weekDays).toHaveLength(7);
      expect(weekDays[0].getDay()).toBe(1); // Monday
      expect(weekDays[6].getDay()).toBe(0); // Sunday
    });

    test('should check if date is today', () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      expect(agenda.isToday(today)).toBe(true);
      expect(agenda.isToday(yesterday)).toBe(false);
    });

    test('should check if two dates are same day', () => {
      const date1 = new Date('2024-01-10 10:00:00');
      const date2 = new Date('2024-01-10 15:30:00');
      const date3 = new Date('2024-01-11 10:00:00');
      
      expect(agenda.isSameDay(date1, date2)).toBe(true);
      expect(agenda.isSameDay(date1, date3)).toBe(false);
    });
  });

  describe('Task Date Parsing', () => {
    beforeEach(() => {
      agenda = new Agenda(container);
    });

    test('should parse "Jan 5" format', () => {
      const parsed = agenda.parseTaskDate('Jan 5');
      const currentYear = new Date().getFullYear();
      
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getMonth()).toBe(0); // January
      expect(parsed.getDate()).toBe(5);
      expect(parsed.getFullYear()).toBe(currentYear);
    });

    test('should parse "Jan 5 14:30" format', () => {
      const parsed = agenda.parseTaskDate('Jan 5 14:30');
      
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getMonth()).toBe(0); // January
      expect(parsed.getDate()).toBe(5);
      expect(parsed.getHours()).toBe(14);
      expect(parsed.getMinutes()).toBe(30);
    });

    test('should return null for invalid dates', () => {
      expect(agenda.parseTaskDate('invalid')).toBeNull();
      expect(agenda.parseTaskDate('')).toBeNull();
      expect(agenda.parseTaskDate(null)).toBeNull();
    });

    test('should extract time from task', () => {
      const task1 = { schedule: 'Jan 5 14:30' };
      const task2 = { due: 'Jan 5 09:15' };
      const task3 = { schedule: 'Jan 5' };
      
      const time1 = agenda.extractTimeFromTask(task1);
      expect(time1).toEqual({ hour: 14, minute: 30 });
      
      const time2 = agenda.extractTimeFromTask(task2);
      expect(time2).toEqual({ hour: 9, minute: 15 });
      
      const time3 = agenda.extractTimeFromTask(task3);
      expect(time3).toBeNull();
    });
  });

  describe('Task Filtering', () => {
    beforeEach(() => {
      const tasks = [
        { id: '1', text: 'Task 1', schedule: 'Jan 5', status: 'TODO' },
        { id: '2', text: 'Task 2', due: 'Jan 5', status: 'TODO' },
        { id: '3', text: 'Task 3', schedule: 'Jan 6', status: 'TODO' },
        { id: '4', text: 'Task 4', status: 'TODO' }, // No date
      ];
      
      agenda = new Agenda(container, { tasks });
    });

    test('should get tasks for specific day', () => {
      const testDate = new Date(`Jan 5 ${new Date().getFullYear()}`);
      const tasksForDay = agenda.getTasksForDay(testDate);
      
      expect(tasksForDay).toHaveLength(2);
      expect(tasksForDay[0].id).toBe('1');
      expect(tasksForDay[1].id).toBe('2');
    });

    test('should return empty array for day with no tasks', () => {
      const testDate = new Date(`Jan 10 ${new Date().getFullYear()}`);
      const tasksForDay = agenda.getTasksForDay(testDate);
      
      expect(tasksForDay).toHaveLength(0);
    });
  });

  describe('View Rendering', () => {
    beforeEach(() => {
      const tasks = [
        { id: '1', text: 'Test task', schedule: 'Jan 5', status: 'TODO' }
      ];
      agenda = new Agenda(container, { tasks });
    });

    test('should render week view by default', () => {
      expect(container.classList.contains('agenda-week-view')).toBe(true);
      expect(container.querySelector('.agenda-header')).toBeTruthy();
      expect(container.querySelector('.agenda-week-container')).toBeTruthy();
    });

    test('should render day view', () => {
      agenda.setView('day');
      
      expect(container.classList.contains('agenda-day-view')).toBe(true);
      expect(container.querySelector('.agenda-day-container')).toBeTruthy();
      // Day view now shows every second hour (12 slots) unless there are tasks requiring more detail
      expect(container.querySelectorAll('.agenda-time-slot').length).toBeGreaterThanOrEqual(12);
    });


    test('should render month view', () => {
      agenda.setView('month');
      
      expect(container.classList.contains('agenda-month-view')).toBe(true);
      expect(container.querySelector('.agenda-month-container')).toBeTruthy();
    });
  });

  describe('Task Element Creation', () => {
    beforeEach(() => {
      agenda = new Agenda(container);
    });

    test('should create basic task element', () => {
      const task = { id: '1', text: 'Test task', status: 'TODO' };
      const taskElement = agenda.createTaskElement(task);
      
      expect(taskElement.classList.contains('agenda-task')).toBe(true);
      expect(taskElement.dataset.id).toBe('1');
      expect(taskElement.querySelector('.agenda-task-text').textContent).toBe('Test task');
      expect(taskElement.querySelector('.agenda-task-status').textContent).toBe('TODO');
    });

    test('should create priority task element', () => {
      const task = { id: '1', text: 'Priority task', status: 'TODO', priority: true };
      const taskElement = agenda.createTaskElement(task);
      
      expect(taskElement.classList.contains('agenda-task-priority')).toBe(true);
    });

    test('should create blocked task element', () => {
      const task = { id: '1', text: 'Blocked task', status: 'TODO', blocked: true };
      const taskElement = agenda.createTaskElement(task);
      
      expect(taskElement.classList.contains('agenda-task-blocked')).toBe(true);
    });

    test('should create completed task element', () => {
      const task = { id: '1', text: 'Done task', status: 'DONE' };
      const taskElement = agenda.createTaskElement(task);
      
      expect(taskElement.classList.contains('agenda-task-completed')).toBe(true);
    });

    test('should include metadata in task element', () => {
      const task = {
        id: '1',
        text: 'Task with metadata',
        status: 'TODO',
        assign: 'Alice',
        tags: ['urgent', 'bug'],
        schedule: 'Jan 5 14:30'
      };
      const taskElement = agenda.createTaskElement(task);
      
      expect(taskElement.querySelector('.agenda-task-schedule').textContent).toContain('on Jan 5 14:30');
      expect(taskElement.querySelector('.agenda-task-meta').textContent).toContain('@Alice');
      expect(taskElement.querySelector('.agenda-task-meta').textContent).toContain('urgent');
      expect(taskElement.querySelector('.agenda-task-meta').textContent).toContain('bug');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      const startDate = new Date('2024-01-10');
      agenda = new Agenda(container, { startDate });
    });

    test('should navigate to next day', () => {
      const originalDate = new Date(agenda.options.startDate);
      agenda.options.view = 'day';
      agenda.navigateNext();
      
      expect(agenda.options.startDate.getDate()).toBe(originalDate.getDate() + 1);
    });

    test('should navigate to previous week', () => {
      const originalDate = new Date(agenda.options.startDate);
      agenda.options.view = 'week';
      agenda.navigatePrevious();
      
      expect(agenda.options.startDate.getDate()).toBe(originalDate.getDate() - 7);
    });

    test('should navigate to next month', () => {
      const originalDate = new Date(agenda.options.startDate);
      agenda.options.view = 'month';
      agenda.navigateNext();
      
      expect(agenda.options.startDate.getMonth()).toBe(originalDate.getMonth() + 1);
    });

    test('should go to today', () => {
      agenda.goToToday();
      
      const today = new Date();
      expect(agenda.isSameDay(agenda.options.startDate, today)).toBe(true);
    });

    test('should not cause exponential jumps with repeated navigation', () => {
      const startDate = new Date('2024-01-15');
      agenda.options.startDate = startDate;
      agenda.options.view = 'day';
      
      // Navigate forward 5 times, should be 5 days ahead
      for (let i = 0; i < 5; i++) {
        agenda.navigateNext();
      }
      
      const expectedDate = new Date('2024-01-20');
      expect(agenda.options.startDate.toDateString()).toBe(expectedDate.toDateString());
      
      // Navigate back 5 times, should be back to original
      for (let i = 0; i < 5; i++) {
        agenda.navigatePrevious();
      }
      
      expect(agenda.options.startDate.toDateString()).toBe(startDate.toDateString());
    });

    test('should handle week navigation correctly in both directions', () => {
      const startDate = new Date('2024-01-15'); // Monday
      agenda.options.startDate = startDate;
      agenda.options.view = 'week';
      
      // Navigate forward 3 weeks
      for (let i = 0; i < 3; i++) {
        agenda.navigateNext();
      }
      
      const expectedForward = new Date('2024-02-05'); // 3 weeks later
      expect(agenda.options.startDate.toDateString()).toBe(expectedForward.toDateString());
      
      // Navigate back 3 weeks, should be back to original
      for (let i = 0; i < 3; i++) {
        agenda.navigatePrevious();
      }
      
      expect(agenda.options.startDate.toDateString()).toBe(startDate.toDateString());
    });

    test('should debug day navigation step by step', () => {
      const startDate = new Date('2024-09-07'); // Sept 7
      agenda.options.startDate = new Date(startDate); // Create a copy
      agenda.setView('day'); // Use setView to ensure proper initialization
      
      console.log('Initial date:', agenda.options.startDate.toDateString());
      console.log('View:', agenda.options.view);
      
      // First click
      agenda.navigateNext();
      console.log('After 1st next:', agenda.options.startDate.toDateString());
      console.log('View after 1st:', agenda.options.view);
      expect(agenda.options.startDate.toDateString()).toBe('Sun Sep 08 2024');
      
      // Second click
      agenda.navigateNext();
      console.log('After 2nd next:', agenda.options.startDate.toDateString());
      console.log('View after 2nd:', agenda.options.view);
      expect(agenda.options.startDate.toDateString()).toBe('Mon Sep 09 2024');
      
      // Third click
      agenda.navigateNext();
      console.log('After 3rd next:', agenda.options.startDate.toDateString());
      console.log('View after 3rd:', agenda.options.view);
      expect(agenda.options.startDate.toDateString()).toBe('Tue Sep 10 2024');
    });

    test('should isolate the exact navigation issue', () => {
      // Set up the exact same way as the working test
      const startDate = new Date('2024-09-07'); // Sept 7
      agenda.options.startDate = new Date(startDate);
      agenda.options.view = 'day'; // Set view directly without calling setView
      
      console.log('Initial startDate:', agenda.options.startDate.toDateString());
      console.log('Initial view:', agenda.options.view);
      
      // Call navigateNext directly (this works in other tests)
      agenda.navigateNext();
      
      console.log('After navigateNext:', agenda.options.startDate.toDateString());
      expect(agenda.options.startDate.toDateString()).toBe('Sun Sep 08 2024');
    });

    test('should check if render() mutates the date', () => {
      const startDate = new Date('2024-09-07'); // Sept 7
      agenda.options.startDate = new Date(startDate);
      agenda.options.view = 'day';
      
      console.log('Before render:', agenda.options.startDate.toDateString());
      agenda.render();
      console.log('After render:', agenda.options.startDate.toDateString());
      
      expect(agenda.options.startDate.toDateString()).toBe('Sat Sep 07 2024');
    });
  });

  describe('Events', () => {
    beforeEach(() => {
      agenda = new Agenda(container);
    });

    test('should emit navigation events', (done) => {
      container.addEventListener('agenda:navigate', (e) => {
        expect(e.detail.view).toBe('week');
        expect(e.detail.date).toBeInstanceOf(Date);
        done();
      });
      
      agenda.options.view = 'week';
      agenda.navigateNext();
    });

    test('should emit view change events', (done) => {
      container.addEventListener('agenda:view-change', (e) => {
        expect(e.detail.view).toBe('day');
        done();
      });
      
      agenda.setView('day');
    });

    test('should emit task update events', (done) => {
      const tasks = [{ id: '1', text: 'Test', status: 'TODO' }];
      
      container.addEventListener('agenda:tasks-update', (e) => {
        expect(e.detail.tasks).toEqual(tasks);
        done();
      });
      
      agenda.setTasks(tasks);
    });
  });
});

describe('AgendaElement Web Component', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('clarity-agenda');
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  test('should be defined', () => {
    expect(customElements.get('clarity-agenda')).toBeDefined();
  });

  test('should create shadow DOM', () => {
    expect(element.shadowRoot).toBeTruthy();
  });

  test('should parse tasks from data attribute', () => {
    const tasks = [
      { id: '1', text: 'Test task', status: 'TODO', schedule: 'Jan 5' }
    ];
    
    element.setAttribute('data-tasks', JSON.stringify(tasks));
    
    // Wait for component to initialize
    setTimeout(() => {
      expect(element.agenda.options.tasks).toEqual(tasks);
    }, 0);
  });

  test('should parse view from data attribute', () => {
    element.setAttribute('data-view', 'day');
    
    setTimeout(() => {
      expect(element.agenda.options.view).toBe('day');
    }, 0);
  });

  test('should have public methods', () => {
    expect(typeof element.setTasks).toBe('function');
    expect(typeof element.setView).toBe('function');
    expect(typeof element.goToToday).toBe('function');
  });

  test('should handle invalid JSON gracefully', () => {
    // Should not throw error
    element.setAttribute('data-tasks', 'invalid json');
    
    setTimeout(() => {
      expect(element.agenda.options.tasks).toEqual([]);
    }, 0);
  });
});
