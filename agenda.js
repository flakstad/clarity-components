class Agenda {
  constructor(el, options = {}) {
    this.el = el;
    this.options = {
      assignees: options.assignees || [],
      tags: options.tags || [],
      statusLabels: options.statusLabels || [
        { label: 'TODO', isEndState: false },
        { label: 'DONE', isEndState: true }
      ],
      view: options.view || 'week', // 'day', 'week', 'month', 'all-tasks'
      startDate: options.startDate || new Date(),
      tasks: options.tasks || [],
      projects: options.projects || [], // Array of project objects with id, name, tasks
      showAllTasks: options.showAllTasks || false, // Show all tasks regardless of schedule/due
      showCompletedTasks: options.showCompletedTasks || false, // Show completed tasks with timestamps
      ...options
    };
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    switch (this.options.view) {
      case 'day':
        this.renderDayView();
        break;
      case 'week':
        this.renderWeekView();
        break;
      case 'month':
        this.renderMonthView();
        break;
      case 'all-tasks':
        this.renderAllTasksView();
        break;
      default:
        this.renderWeekView();
    }
  }

  renderWeekView() {
    const startOfWeek = this.getStartOfWeek(this.options.startDate);
    const days = this.getWeekDays(startOfWeek);
    
    this.el.innerHTML = '';
    this.el.className = 'agenda-container agenda-week-view';

    const header = document.createElement('div');
    header.className = 'agenda-header';
    header.innerHTML = `
      <h2>Week of ${this.formatDate(startOfWeek)}</h2>
      <div class="agenda-controls">
        <div class="agenda-view-toggles">
          <button class="agenda-view-btn" data-view="day">Day</button>
          <button class="agenda-view-btn active" data-view="week">Week</button>
          <button class="agenda-view-btn" data-view="month">Month</button>
          <button class="agenda-view-btn" data-view="all-tasks">All Tasks</button>
        </div>
        <div class="agenda-nav">
          <button class="agenda-nav-btn" data-action="prev-week">‹ Previous</button>
          <button class="agenda-nav-btn" data-action="today">Today</button>
          <button class="agenda-nav-btn" data-action="next-week">Next ›</button>
        </div>
      </div>
    `;
    this.el.appendChild(header);

    const weekContainer = document.createElement('div');
    weekContainer.className = 'agenda-week-container';

    days.forEach(day => {
      const dayElement = this.createVerticalDayElement(day);
      weekContainer.appendChild(dayElement);
    });


    this.el.appendChild(weekContainer);
  }

  renderDayView() {
    const day = new Date(this.options.startDate.getFullYear(), this.options.startDate.getMonth(), this.options.startDate.getDate());
    
    this.el.innerHTML = '';
    this.el.className = 'agenda-container agenda-day-view';

    const header = document.createElement('div');
    header.className = 'agenda-header';
    header.innerHTML = `
      <h2>${this.formatDayHeader(day)}</h2>
      <div class="agenda-controls">
        <div class="agenda-view-toggles">
          <button class="agenda-view-btn active" data-view="day">Day</button>
          <button class="agenda-view-btn" data-view="week">Week</button>
          <button class="agenda-view-btn" data-view="month">Month</button>
          <button class="agenda-view-btn" data-view="all-tasks">All Tasks</button>
        </div>
        <div class="agenda-nav">
          <button class="agenda-nav-btn" data-action="prev-day">‹ Previous</button>
          <button class="agenda-nav-btn" data-action="today">Today</button>
          <button class="agenda-nav-btn" data-action="next-day">Next ›</button>
        </div>
      </div>
    `;
    this.el.appendChild(header);

    const dayContainer = document.createElement('div');
    dayContainer.className = 'agenda-day-container';

    // Get tasks for this day to determine which hours need to be shown
    const dayTasks = this.getTasksForDay(day);
    const taskHours = new Set();
    
    dayTasks.forEach(task => {
      const taskTime = this.extractTimeFromTask(task);
      if (taskTime) {
        taskHours.add(taskTime.hour);
        // Also add adjacent hours for context
        if (taskTime.hour > 0) taskHours.add(taskTime.hour - 1);
        if (taskTime.hour < 23) taskHours.add(taskTime.hour + 1);
      }
    });

    // Create time slots - show every second hour unless there are tasks that need detail
    for (let hour = 0; hour < 24; hour += 2) {
      // Always show even hours, but also show odd hours if they have tasks or are adjacent to tasks
      const hoursToShow = [hour];
      if (hour + 1 < 24 && taskHours.has(hour + 1)) {
        hoursToShow.push(hour + 1);
      }
      
      hoursToShow.forEach(h => {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'agenda-time-slot';
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'agenda-time-label';
        timeLabel.textContent = this.formatHour(h);
        
        const timeContent = document.createElement('div');
        timeContent.className = 'agenda-time-content';
        
        
        // Add tasks for this specific hour
        const hourTasks = dayTasks.filter(task => {
          const taskTime = this.extractTimeFromTask(task);
          return taskTime && taskTime.hour === h;
        });
        
        hourTasks.forEach(task => {
          const taskElement = this.createTaskElement(task);
          taskElement.classList.add('agenda-task-inline');
          timeContent.appendChild(taskElement);
        });
        
        timeSlot.appendChild(timeLabel);
        timeSlot.appendChild(timeContent);
        dayContainer.appendChild(timeSlot);
      });
    }

    // Add tasks without specific times at the end
    const untimedTasks = dayTasks.filter(task => !this.extractTimeFromTask(task));
    if (untimedTasks.length > 0) {
      const untimedSection = document.createElement('div');
      untimedSection.className = 'agenda-untimed-tasks';
      
      const untimedContent = document.createElement('div');
      untimedContent.className = 'agenda-time-content';
      
      untimedTasks.forEach(task => {
        const taskElement = this.createTaskElement(task);
        taskElement.classList.add('agenda-task-inline');
        untimedContent.appendChild(taskElement);
      });
      
      untimedSection.appendChild(untimedContent);
      dayContainer.appendChild(untimedSection);
    }

    // Add overdue tasks at the bottom if this is today
    const now = new Date();
    if (this.isSameDay(day, now)) {
      const overdueTasks = this.getOverdueTasks();
      if (overdueTasks.length > 0) {
        const overdueSection = document.createElement('div');
        overdueSection.className = 'agenda-overdue-tasks';
        
        const overdueContent = document.createElement('div');
        overdueContent.className = 'agenda-time-content';
        
        overdueTasks.forEach(task => {
          const taskElement = this.createOverdueTaskElement(task);
          taskElement.classList.add('agenda-task-inline');
          overdueContent.appendChild(taskElement);
        });
        
        overdueSection.appendChild(overdueContent);
        dayContainer.appendChild(overdueSection);
      }

      // Add tasks due within 3 days
      const upcomingDueTasks = this.getUpcomingDueTasks();
      if (upcomingDueTasks.length > 0) {
        const upcomingSection = document.createElement('div');
        upcomingSection.className = 'agenda-upcoming-tasks';
        
        const upcomingContent = document.createElement('div');
        upcomingContent.className = 'agenda-time-content';
        
        upcomingDueTasks.forEach(task => {
          const taskElement = this.createTaskElement(task);
          taskElement.classList.add('agenda-task-inline');
          upcomingContent.appendChild(taskElement);
        });
        
        upcomingSection.appendChild(upcomingContent);
        dayContainer.appendChild(upcomingSection);
      }

      // Add "now" marker
      const nowMarker = document.createElement('div');
      nowMarker.className = 'agenda-now-marker-line';
      
      // Calculate position based on current time
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const timePercent = (currentHour * 60 + currentMinute) / (24 * 60) * 100;
      
      nowMarker.style.position = 'absolute';
      nowMarker.style.top = `${timePercent}%`;
      nowMarker.style.left = '0';
      nowMarker.style.right = '0';
      nowMarker.style.height = '2px';
      nowMarker.style.background = 'var(--clarity-agenda-color-now)';
      nowMarker.style.zIndex = '20';
      nowMarker.style.borderTop = '2px dotted var(--clarity-agenda-color-now)';
      
      const nowLabel = document.createElement('span');
      nowLabel.textContent = 'Now';
      nowLabel.style.position = 'absolute';
      nowLabel.style.left = '0.5rem';
      nowLabel.style.top = '-0.8rem';
      nowLabel.style.fontSize = '0.7em';
      nowLabel.style.fontWeight = 'bold';
      nowLabel.style.color = 'var(--clarity-agenda-color-now)';
      nowLabel.style.background = 'var(--clarity-agenda-bg-primary)';
      nowLabel.style.padding = '0 0.25rem';
      
      nowMarker.appendChild(nowLabel);
      
      // Make dayContainer relative positioned so the absolute now marker works
      dayContainer.style.position = 'relative';
      dayContainer.appendChild(nowMarker);
    }

    this.el.appendChild(dayContainer);
  }


  renderMonthView() {
    const startOfMonth = new Date(this.options.startDate.getFullYear(), this.options.startDate.getMonth(), 1);
    const endOfMonth = new Date(this.options.startDate.getFullYear(), this.options.startDate.getMonth() + 1, 0);
    
    const days = [];
    const totalDays = endOfMonth.getDate();
    
    // Get all days in the month
    for (let i = 0; i < totalDays; i++) {
      days.push(new Date(startOfMonth.getTime() + (i * 24 * 60 * 60 * 1000)));
    }
    
    this.el.innerHTML = '';
    this.el.className = 'agenda-container agenda-month-view';

    const header = document.createElement('div');
    header.className = 'agenda-header';
    header.innerHTML = `
      <h2>${this.formatMonthHeader(this.options.startDate)}</h2>
      <div class="agenda-controls">
        <div class="agenda-view-toggles">
          <button class="agenda-view-btn" data-view="day">Day</button>
          <button class="agenda-view-btn" data-view="week">Week</button>
          <button class="agenda-view-btn active" data-view="month">Month</button>
          <button class="agenda-view-btn" data-view="all-tasks">All Tasks</button>
        </div>
        <div class="agenda-nav">
          <button class="agenda-nav-btn" data-action="prev-month">‹ Previous</button>
          <button class="agenda-nav-btn" data-action="today">Today</button>
          <button class="agenda-nav-btn" data-action="next-month">Next ›</button>
        </div>
      </div>
    `;
    this.el.appendChild(header);

    const monthContainer = document.createElement('div');
    monthContainer.className = 'agenda-month-container';

    days.forEach(day => {
      const dayElement = this.createVerticalDayElement(day);
      monthContainer.appendChild(dayElement);
    });

    this.el.appendChild(monthContainer);
  }

  renderAllTasksView() {
    this.el.innerHTML = '';
    this.el.className = 'agenda-container agenda-all-tasks-view';

    const header = document.createElement('div');
    header.className = 'agenda-header';
    header.innerHTML = `
      <h2>All Tasks</h2>
      <div class="agenda-controls">
        <div class="agenda-view-toggles">
          <button class="agenda-view-btn" data-view="day">Day</button>
          <button class="agenda-view-btn" data-view="week">Week</button>
          <button class="agenda-view-btn" data-view="month">Month</button>
          <button class="agenda-view-btn active" data-view="all-tasks">All Tasks</button>
        </div>
        <div class="agenda-nav">
          <button class="agenda-nav-btn" data-action="prev-week">‹ Previous</button>
          <button class="agenda-nav-btn" data-action="today">Today</button>
          <button class="agenda-nav-btn" data-action="next-week">Next ›</button>
        </div>
      </div>
    `;
    this.el.appendChild(header);

    const allTasksSection = this.createAllTasksSection();
    this.el.appendChild(allTasksSection);
  }

  createDayElement(day, isMonthView = false) {
    const dayElement = document.createElement('div');
    dayElement.className = 'agenda-day';
    
    if (this.isToday(day)) {
      dayElement.classList.add('agenda-today');
    }
    
    if (isMonthView && day.getMonth() !== this.options.startDate.getMonth()) {
      dayElement.classList.add('agenda-other-month');
    }

    const dayHeader = document.createElement('div');
    dayHeader.className = 'agenda-day-header';
    dayHeader.textContent = isMonthView ? 
      day.getDate().toString() : 
      this.formatDayHeader(day);
    
    dayElement.appendChild(dayHeader);

    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'agenda-day-tasks';

    const dayTasks = this.getTasksForDay(day);
    dayTasks.forEach(task => {
      const taskElement = this.createTaskElement(task);
      tasksContainer.appendChild(taskElement);
    });

    dayElement.appendChild(tasksContainer);
    return dayElement;
  }

  createVerticalDayElement(day) {
    const dayElement = document.createElement('div');
    dayElement.className = 'agenda-day-vertical';
    
    if (this.isToday(day)) {
      dayElement.classList.add('agenda-today');
      // For today, render the full day view with time slots and now marker
      return this.createTodayDayElement(day);
    }

    // Add weekend styling
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      dayElement.classList.add('agenda-weekend');
    }

    const dayHeader = document.createElement('div');
    dayHeader.className = 'agenda-day-header-vertical';
    dayHeader.textContent = this.formatDayHeader(day);
    
    dayElement.appendChild(dayHeader);

    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'agenda-day-tasks-vertical';

    const dayTasks = this.getTasksForDay(day);
    if (dayTasks.length > 0) {
      // Show tasks organized by time slots
      this.renderVerticalDayTasks(tasksContainer, day, dayTasks);
    }

    dayElement.appendChild(tasksContainer);
    return dayElement;
  }

  createTodayDayElement(day) {
    const dayElement = document.createElement('div');
    dayElement.className = 'agenda-day-vertical agenda-today agenda-today-expanded';
    
    // Add weekend styling if applicable
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      dayElement.classList.add('agenda-weekend');
    }

    const dayHeader = document.createElement('div');
    dayHeader.className = 'agenda-day-header-vertical';
    dayHeader.textContent = this.formatDayHeader(day);
    dayElement.appendChild(dayHeader);

    const dayContainer = document.createElement('div');
    dayContainer.className = 'agenda-day-container';

    // Get tasks for this day to determine which hours need to be shown
    const dayTasks = this.getTasksForDay(day);
    const taskHours = new Set();
    
    dayTasks.forEach(task => {
      const taskTime = this.extractTimeFromTask(task);
      if (taskTime) {
        taskHours.add(taskTime.hour);
        // Also add adjacent hours for context
        if (taskTime.hour > 0) taskHours.add(taskTime.hour - 1);
        if (taskTime.hour < 23) taskHours.add(taskTime.hour + 1);
      }
    });

    // Create time slots - show every second hour unless there are tasks that need detail
    for (let hour = 0; hour < 24; hour += 2) {
      // Always show even hours, but also show odd hours if they have tasks or are adjacent to tasks
      const hoursToShow = [hour];
      if (hour + 1 < 24 && taskHours.has(hour + 1)) {
        hoursToShow.push(hour + 1);
      }
      
      hoursToShow.forEach(h => {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'agenda-time-slot';
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'agenda-time-label';
        timeLabel.textContent = this.formatHour(h);
        
        const timeContent = document.createElement('div');
        timeContent.className = 'agenda-time-content';
        
        // Add tasks for this specific hour
        const hourTasks = dayTasks.filter(task => {
          const taskTime = this.extractTimeFromTask(task);
          return taskTime && taskTime.hour === h;
        });
        
        hourTasks.forEach(task => {
          const taskElement = this.createTaskElement(task);
          taskElement.classList.add('agenda-task-inline');
          timeContent.appendChild(taskElement);
        });
        
        timeSlot.appendChild(timeLabel);
        timeSlot.appendChild(timeContent);
        dayContainer.appendChild(timeSlot);
      });
    }

    // Add tasks without specific times at the top if there are timed tasks
    const untimedTasks = dayTasks.filter(task => !this.extractTimeFromTask(task));
    if (untimedTasks.length > 0) {
      const untimedSection = document.createElement('div');
      untimedSection.className = 'agenda-time-slot';
      
      const untimedContent = document.createElement('div');
      untimedContent.className = 'agenda-time-content';
      
      untimedTasks.forEach(task => {
        const taskElement = this.createTaskElement(task);
        taskElement.classList.add('agenda-task-inline');
        untimedContent.appendChild(taskElement);
      });
      
      untimedSection.appendChild(untimedContent);
      dayContainer.insertBefore(untimedSection, dayContainer.firstChild);
    }

    // Add "now" marker if this is today
    const now = new Date();
    if (this.isSameDay(day, now)) {
      const nowMarker = document.createElement('div');
      nowMarker.className = 'agenda-now-marker-line';
      
      // Calculate position based on current time
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const timePercent = (currentHour * 60 + currentMinute) / (24 * 60) * 100;
      
      nowMarker.style.position = 'absolute';
      nowMarker.style.top = `${timePercent}%`;
      nowMarker.style.left = '0';
      nowMarker.style.right = '0';
      nowMarker.style.height = '2px';
      nowMarker.style.background = 'var(--clarity-agenda-color-now)';
      nowMarker.style.zIndex = '20';
      nowMarker.style.borderTop = '2px dotted var(--clarity-agenda-color-now)';
      
      const nowLabel = document.createElement('span');
      nowLabel.textContent = 'Now';
      nowLabel.style.position = 'absolute';
      nowLabel.style.left = '0.5rem';
      nowLabel.style.top = '-0.8rem';
      nowLabel.style.fontSize = '0.7em';
      nowLabel.style.fontWeight = 'bold';
      nowLabel.style.color = 'var(--clarity-agenda-color-now)';
      nowLabel.style.background = 'var(--clarity-agenda-bg-primary)';
      nowLabel.style.padding = '0 0.25rem';
      
      nowMarker.appendChild(nowLabel);
      
      // Make dayContainer relative positioned so the absolute now marker works
      dayContainer.style.position = 'relative';
      dayContainer.appendChild(nowMarker);
    }

    dayElement.appendChild(dayContainer);
    return dayElement;
  }

  renderVerticalDayTasks(container, day, dayTasks) {
    const isToday = this.isToday(day);
    const taskHours = new Set();
    const tasksWithTime = [];
    const tasksWithoutTime = [];
    
    // Separate tasks with and without specific times
    dayTasks.forEach(task => {
      const taskTime = this.extractTimeFromTask(task);
      if (taskTime) {
        taskHours.add(taskTime.hour);
        tasksWithTime.push({ task, time: taskTime });
      } else {
        tasksWithoutTime.push(task);
      }
    });

    if (tasksWithTime.length > 0) {
      // Group tasks by hour
      const tasksByHour = new Map();
      tasksWithTime.forEach(({ task, time }) => {
        if (!tasksByHour.has(time.hour)) {
          tasksByHour.set(time.hour, []);
        }
        tasksByHour.get(time.hour).push(task);
      });

      // Determine which hours to show
      const hoursToShow = new Set();
      
      if (isToday) {
        // For today: show every second hour + task hours
        for (let hour = 0; hour < 24; hour += 2) {
          hoursToShow.add(hour);
        }
        // Add all task hours and adjacent hours
        taskHours.forEach(hour => {
          hoursToShow.add(hour);
          if (hour > 0) hoursToShow.add(hour - 1);
          if (hour < 23) hoursToShow.add(hour + 1);
        });
      } else {
        // For other days: only show hours with tasks
        taskHours.forEach(hour => hoursToShow.add(hour));
      }

      // Sort hours and create time slots
      const sortedHours = Array.from(hoursToShow).sort((a, b) => a - b);
      
      sortedHours.forEach(hour => {
        const timeSlot = document.createElement('div');
        timeSlot.className = 'agenda-time-slot-vertical';
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'agenda-time-label-vertical';
        timeLabel.textContent = this.formatHour(hour);
        
        const timeContent = document.createElement('div');
        timeContent.className = 'agenda-time-content-vertical';
        
        // Add "now" marker if this is today and current hour
        if (isToday) {
          const now = new Date();
          if (hour === now.getHours()) {
            const nowMarker = document.createElement('div');
            nowMarker.className = 'agenda-now-marker-vertical';
            nowMarker.textContent = 'now';
            timeContent.appendChild(nowMarker);
          }
        }
        
        // Add tasks for this hour
        const hourTasks = tasksByHour.get(hour) || [];
        hourTasks.forEach(task => {
          const taskElement = this.createTaskElement(task);
          taskElement.classList.add('agenda-task-inline-vertical');
          timeContent.appendChild(taskElement);
        });
        
        // Show empty slot for today's hours without tasks
        if (isToday && hourTasks.length === 0 && hour % 2 === 0) {
          const emptySlot = document.createElement('div');
          emptySlot.className = 'agenda-empty-time-slot';
          emptySlot.textContent = '';
          timeContent.appendChild(emptySlot);
        }
        
        timeSlot.appendChild(timeLabel);
        timeSlot.appendChild(timeContent);
        container.appendChild(timeSlot);
      });
    }

    // Add tasks without specific times at the bottom
    if (tasksWithoutTime.length > 0) {
      const untimedSection = document.createElement('div');
      untimedSection.className = 'agenda-untimed-tasks-bottom';
      
      const untimedContent = document.createElement('div');
      untimedContent.className = 'agenda-time-content-vertical';
      
      tasksWithoutTime.forEach(task => {
        const taskElement = this.createTaskElement(task);
        taskElement.classList.add('agenda-task-inline-vertical');
        untimedContent.appendChild(taskElement);
      });
      
      untimedSection.appendChild(untimedContent);
      container.appendChild(untimedSection);
    }
  }

  extractTimeFromTask(task) {
    // Extract time from schedule or due date
    const dateStr = task.schedule || task.due;
    if (!dateStr) return null;
    
    // Look for time pattern like "14:30" or "2:30 PM"
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return {
        hour: parseInt(timeMatch[1], 10),
        minute: parseInt(timeMatch[2], 10)
      };
    }
    
    return null;
  }

  createTaskElement(task) {
    // Create a wrapper div for the agenda task
    const taskElement = document.createElement('div');
    taskElement.className = 'agenda-task';
    taskElement.dataset.id = task.id;

    // Create constrained outline for this task
    const outlineOptions = {
      statusLabels: this.options.statusLabels,
      features: {
        // Enable task-specific features
        priority: true,
        blocked: true,
        due: true,
        schedule: true,
        assign: true,
        tags: true,
        comments: true,
        worklog: true,
        archive: true,
        // Disable outline-specific features
        addButton: false,
        navigation: false,
        reorder: false
      }
    };

    const taskOutline = Outline.createAgendaItemOutline(taskElement, outlineOptions);
    
    // Prepare task data for the outline
    const outlineTask = {
      ...task,
      // Prepend project name to task text for better organization
      text: task.project ? `${task.project.name}: ${task.text}` : task.text
    };
    
    // The tasks are now pre-rendered in HTML, so we don't need to add them programmatically

    // Add agenda-specific styling classes to the wrapper
    if (task.priority) {
      taskElement.classList.add('priority');
    }
    
    if (task.blocked) {
      taskElement.classList.add('blocked');
    }

    // Determine completion status
    const isCompleted = this.options.statusLabels.find(
      label => label.label === task.status && label.isEndState
    );
    
    if (isCompleted) {
      taskElement.classList.add('completed');
    }

    return taskElement;
  }

  getAllTasks() {
    const allTasks = [...this.options.tasks];
    
    // Add tasks from projects
    this.options.projects.forEach(project => {
      if (project.tasks && Array.isArray(project.tasks)) {
        project.tasks.forEach(task => {
          // Add project context to task
          const taskWithProject = {
            ...task,
            project: {
              id: project.id,
              name: project.name
            }
          };
          allTasks.push(taskWithProject);
        });
      }
    });
    
    return allTasks;
  }

  getTasksForDay(day) {
    const allTasks = this.getAllTasks();
    
    return allTasks.filter(task => {
      // If showAllTasks is enabled, include all tasks
      if (this.options.showAllTasks) {
        return true;
      }
      
      // Check both schedule and due dates
      const taskDate = task.schedule || task.due;
      if (!taskDate) return false;
      
      const parsedDate = this.parseTaskDate(taskDate);
      return parsedDate && this.isSameDay(parsedDate, day);
    });
  }

  parseTaskDate(dateStr) {
    if (!dateStr) return null;
    
    // Handle various date formats
    // "Jan 5", "Jan 5 14:30", ISO strings, etc.
    try {
      // If it looks like "Jan 5" or "Jan 5 14:30"
      if (dateStr.match(/^[A-Za-z]{3} \d{1,2}( \d{1,2}:\d{2})?$/)) {
        const currentYear = new Date().getFullYear();
        const fullDateStr = `${dateStr} ${currentYear}`;
        return new Date(fullDateStr);
      }
      
      // Try parsing as-is
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch (e) {
      return null;
    }
  }

  getStartOfWeek(date) {
    const day = date.getDay();
    // Adjust for Monday as first day (0=Sunday, 1=Monday, etc.)
    const diff = day === 0 ? -6 : 1 - day;
    return new Date(date.getTime() + (diff * 24 * 60 * 60 * 1000));
  }

  getWeekDays(startOfWeek) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(startOfWeek.getTime() + (i * 24 * 60 * 60 * 1000)));
    }
    return days;
  }

  isToday(date) {
    const today = new Date();
    return this.isSameDay(date, today);
  }

  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  formatDate(date) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatDayHeader(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  formatMonthHeader(date) {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  formatHour(hour) {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  formatCompletionTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  getOverdueTasks() {
    const allTasks = this.getAllTasks();
    const today = new Date();
    
    return allTasks.filter(task => {
      // Only include tasks that are not completed
      const isCompleted = this.options.statusLabels.find(
        label => label.label === task.status && label.isEndState
      );
      if (isCompleted) return false;
      
      // Only include tasks with due dates (not scheduled dates)
      if (!task.due) return false;
      
      const parsedDate = this.parseTaskDate(task.due);
      if (!parsedDate) return false;
      
      // Check if the due date is in the past
      return parsedDate < today;
    });
  }

  getUpcomingDueTasks() {
    const allTasks = this.getAllTasks();
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    return allTasks.filter(task => {
      // Only include tasks that are not completed
      const isCompleted = this.options.statusLabels.find(
        label => label.label === task.status && label.isEndState
      );
      if (isCompleted) return false;
      
      // Only include tasks with due dates (not scheduled dates)
      if (!task.due) return false;
      
      const parsedDate = this.parseTaskDate(task.due);
      if (!parsedDate) return false;
      
      // Check if the due date is within the next 3 days (but not today or overdue)
      return parsedDate > today && parsedDate <= threeDaysFromNow;
    });
  }

  createOverdueTaskElement(task) {
    const taskElement = this.createTaskElement(task);
    
    // Add overdue information
    const parsedDate = this.parseTaskDate(task.due);
    const today = new Date();
    const diffMs = today - parsedDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    const overdueSpan = document.createElement('span');
    overdueSpan.className = 'agenda-task-overdue-info';
    overdueSpan.textContent = ` (${diffDays} day${diffDays !== 1 ? 's' : ''} overdue)`;
    
    const taskContent = taskElement.querySelector('.agenda-task-content');
    taskContent.appendChild(overdueSpan);
    
    return taskElement;
  }

  createAllTasksSection() {
    const allTasks = this.getAllTasks();
    const section = document.createElement('div');
    section.className = 'agenda-all-tasks-section';
    
    const header = document.createElement('div');
    header.className = 'agenda-section-header';
    header.textContent = 'All Tasks';
    section.appendChild(header);
    
    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'agenda-all-tasks-container';
    
    // Sort tasks alphabetically by project name, then by task text
    const sortedTasks = allTasks.sort((a, b) => {
      const projectA = a.project ? a.project.name : 'No Project';
      const projectB = b.project ? b.project.name : 'No Project';
      
      // First sort by project name
      if (projectA !== projectB) {
        return projectA.localeCompare(projectB);
      }
      
      // Then sort by task text within the same project
      return a.text.localeCompare(b.text);
    });
    
    // Render all tasks in sorted order
    sortedTasks.forEach(task => {
      const taskElement = this.createTaskElement(task);
      taskElement.classList.add('agenda-task-all');
      tasksContainer.appendChild(taskElement);
    });
    
    section.appendChild(tasksContainer);
    return section;
  }


  bindEvents() {
    // Navigation and view events
    this.el.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const view = e.target.dataset.view;
      
      if (view) {
        // View toggle button clicked
        this.setView(view);
        return;
      }
      
      if (!action) return;

      switch (action) {
        case 'prev-day':
        case 'prev-week':
        case 'prev-month':
          this.navigatePrevious();
          break;
        case 'next-day':
        case 'next-week':
        case 'next-month':
          this.navigateNext();
          break;
        case 'today':
          this.goToToday();
          break;
      }
    });

    // Task click events
    this.el.addEventListener('click', (e) => {
      const taskElement = e.target.closest('.agenda-task');
      if (taskElement) {
        this.emit('agenda:task-click', {
          taskId: taskElement.dataset.id,
          task: this.options.tasks.find(t => t.id === taskElement.dataset.id)
        });
      }
    });
  }

  navigatePrevious() {
    // Create completely new date object to avoid any mutation
    const currentTime = this.options.startDate.getTime();
    let newDate;
    
    if (this.options.view === 'day') {
      // Previous day: subtract exactly 24 hours
      newDate = new Date(currentTime - 86400000); // 24 * 60 * 60 * 1000
    } else if (this.options.view === 'week') {
      // Previous week: subtract exactly 7 days
      newDate = new Date(currentTime - 604800000); // 7 * 24 * 60 * 60 * 1000
    } else if (this.options.view === 'month') {
      // Previous month: use constructor to avoid mutations
      const year = this.options.startDate.getFullYear();
      const month = this.options.startDate.getMonth();
      const date = this.options.startDate.getDate();
      newDate = new Date(year, month - 1, date);
    }
    
    // Replace the startDate completely
    this.options.startDate = newDate;
    this.render();
    this.emit('agenda:navigate', { view: this.options.view, date: newDate });
  }

  navigateNext() {
    // Create completely new date object to avoid any mutation
    const currentTime = this.options.startDate.getTime();
    let newDate;
    
    if (this.options.view === 'day') {
      // Next day: add exactly 24 hours
      newDate = new Date(currentTime + 86400000); // 24 * 60 * 60 * 1000
    } else if (this.options.view === 'week') {
      // Next week: add exactly 7 days
      newDate = new Date(currentTime + 604800000); // 7 * 24 * 60 * 60 * 1000
    } else if (this.options.view === 'month') {
      // Next month: use constructor to avoid mutations
      const year = this.options.startDate.getFullYear();
      const month = this.options.startDate.getMonth();
      const date = this.options.startDate.getDate();
      newDate = new Date(year, month + 1, date);
    }
    
    // Replace the startDate completely
    this.options.startDate = newDate;
    this.render();
    this.emit('agenda:navigate', { view: this.options.view, date: newDate });
  }

  goToToday() {
    this.options.startDate = new Date();
    this.render();
    this.emit('agenda:navigate', { view: this.options.view, date: this.options.startDate });
  }

  setView(view) {
    this.options.view = view;
    this.render();
    this.emit('agenda:view-change', { view });
  }

  setTasks(tasks) {
    this.options.tasks = tasks;
    this.render();
    this.emit('agenda:tasks-update', { tasks });
  }

  emit(eventName, data) {
    const event = new CustomEvent(eventName, {
      detail: data,
      bubbles: true
    });
    this.el.dispatchEvent(event);
  }
}

// Web Component Wrapper
class AgendaElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.agenda = null;
  }

  connectedCallback() {
    this.addStyles();
    this.init();
  }

  init() {
    // Create container
    const container = document.createElement('div');
    container.className = 'agenda-wrapper';
    this.shadowRoot.appendChild(container);

    // Parse options from attributes
    const options = this.parseOptions();
    
    // Initialize agenda
    this.agenda = new Agenda(container, options);

    // Listen for attribute changes
    this.observer = new MutationObserver(() => {
      this.rerenderFromAttribute();
    });
    
    this.observer.observe(this, {
      attributes: true,
      attributeFilter: ['data-tasks', 'data-view', 'data-start-date', 'data-projects', 'data-show-all-tasks', 'data-show-completed-tasks']
    });
  }

  parseOptions() {
    const options = {};
    
    // Parse tasks
    if (this.hasAttribute('data-tasks')) {
      try {
        options.tasks = JSON.parse(this.getAttribute('data-tasks'));
      } catch (e) {
        console.warn('Invalid tasks JSON:', e);
        options.tasks = [];
      }
    }

    // Parse view
    if (this.hasAttribute('data-view')) {
      options.view = this.getAttribute('data-view');
    }

    // Parse start date
    if (this.hasAttribute('data-start-date')) {
      options.startDate = new Date(this.getAttribute('data-start-date'));
    }

    // Parse assignees
    if (this.hasAttribute('data-assignees')) {
      try {
        options.assignees = JSON.parse(this.getAttribute('data-assignees'));
      } catch (e) {
        console.warn('Invalid assignees JSON:', e);
      }
    }

    // Parse tags
    if (this.hasAttribute('data-tags')) {
      try {
        options.tags = JSON.parse(this.getAttribute('data-tags'));
      } catch (e) {
        console.warn('Invalid tags JSON:', e);
      }
    }

    // Parse status labels
    if (this.hasAttribute('data-status-labels')) {
      try {
        options.statusLabels = JSON.parse(this.getAttribute('data-status-labels'));
      } catch (e) {
        console.warn('Invalid status labels JSON:', e);
      }
    }

    // Parse projects
    if (this.hasAttribute('data-projects')) {
      try {
        options.projects = JSON.parse(this.getAttribute('data-projects'));
      } catch (e) {
        console.warn('Invalid projects JSON:', e);
      }
    }

    // Parse show all tasks flag
    if (this.hasAttribute('data-show-all-tasks')) {
      options.showAllTasks = this.getAttribute('data-show-all-tasks') === 'true';
    }

    // Parse show completed tasks flag
    if (this.hasAttribute('data-show-completed-tasks')) {
      options.showCompletedTasks = this.getAttribute('data-show-completed-tasks') === 'true';
    }

    return options;
  }

  rerenderFromAttribute() {
    if (!this.agenda) return;
    
    const options = this.parseOptions();
    // Don't overwrite startDate unless it's explicitly changed in the attribute
    const currentStartDate = this.agenda.options.startDate;
    Object.assign(this.agenda.options, options);
    // Restore the current startDate if it wasn't explicitly set in attributes
    if (!this.hasAttribute('data-start-date')) {
      this.agenda.options.startDate = currentStartDate;
    }
    this.agenda.render();
  }

  // Public methods
  setTasks(tasks) {
    if (this.agenda) {
      this.agenda.setTasks(tasks);
    }
  }

  setView(view) {
    if (this.agenda) {
      this.agenda.setView(view);
    }
  }

  goToToday() {
    if (this.agenda) {
      this.agenda.goToToday();
    }
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* CSS Custom Properties for Theming */
      :host {
        display: block;
        font-family: monospace;
        width: 100%;
        
        /* Inherit theme variables from outline component */
        --clarity-agenda-bg-primary: var(--clarity-outline-bg-primary);
        --clarity-agenda-bg-secondary: var(--clarity-outline-bg-secondary);
        --clarity-agenda-bg-tertiary: var(--clarity-outline-bg-tertiary);
        --clarity-agenda-text-primary: var(--clarity-outline-text-primary);
        --clarity-agenda-text-secondary: var(--clarity-outline-text-secondary);
        --clarity-agenda-text-muted: var(--clarity-outline-text-muted);
        --clarity-agenda-border: var(--clarity-outline-border);
        --clarity-agenda-border-focus: var(--clarity-outline-border-focus);
        --clarity-agenda-hover: var(--clarity-outline-hover);
        --clarity-agenda-focus: var(--clarity-outline-focus);
        
        /* Semantic colors */
        --clarity-agenda-color-todo: var(--clarity-outline-color-todo, #d16d7a);
        --clarity-agenda-color-done: var(--clarity-outline-color-done, #6c757d);
        --clarity-agenda-color-priority: var(--clarity-outline-color-priority, #5f9fb0);
        --clarity-agenda-color-blocked: var(--clarity-outline-color-blocked, #f39c12);
        --clarity-agenda-color-today: #4a9eff;
        --clarity-agenda-color-now: #ff6b6b;
        
        /* Component-level customization */
        --clarity-agenda-spacing: 0.5rem;
        --clarity-agenda-padding: 0.75rem;
        --clarity-agenda-border-radius: 4px;
        --clarity-agenda-font-size: inherit;
        --clarity-agenda-line-height: 1.4;
        --clarity-agenda-transition-duration: 0.15s;
      }

      .agenda-wrapper {
        background: var(--clarity-agenda-bg-primary);
        color: var(--clarity-agenda-text-primary);
        font-family: inherit;
        font-size: var(--clarity-agenda-font-size);
        line-height: var(--clarity-agenda-line-height);
      }

      /* Header */
      .agenda-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--clarity-agenda-padding);
        margin-bottom: var(--clarity-agenda-spacing);
      }

      .agenda-header h2 {
        margin: 0;
        font-size: 1.2em;
        font-weight: bold;
        color: var(--clarity-agenda-text-primary);
      }

      .agenda-controls {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-end;
      }

      .agenda-view-toggles {
        display: flex;
        gap: 0.25rem;
        background: var(--clarity-agenda-bg-secondary);
        border-radius: var(--clarity-agenda-border-radius);
        padding: 0.25rem;
      }

      .agenda-view-btn {
        background: none;
        border: none;
        color: var(--clarity-agenda-text-secondary);
        padding: 0.25rem 0.75rem;
        border-radius: calc(var(--clarity-agenda-border-radius) - 2px);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.85em;
        font-weight: 500;
        transition: all var(--clarity-agenda-transition-duration) ease;
      }

      .agenda-view-btn:hover {
        background: var(--clarity-agenda-hover);
        color: var(--clarity-agenda-text-primary);
      }

      .agenda-view-btn.active {
        background: var(--clarity-agenda-focus);
        color: var(--clarity-agenda-text-primary);
        font-weight: bold;
      }

      .agenda-view-btn:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--clarity-agenda-border-focus);
      }

      .agenda-nav {
        display: flex;
        gap: 0.5rem;
      }

      .agenda-nav-btn {
        background: none;
        border: none;
        color: var(--clarity-agenda-text-secondary);
        padding: 0.25rem 0.5rem;
        border-radius: var(--clarity-agenda-border-radius);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9em;
        transition: all var(--clarity-agenda-transition-duration) ease;
      }

      .agenda-nav-btn:hover {
        background: var(--clarity-agenda-hover);
        color: var(--clarity-agenda-text-primary);
      }

      .agenda-nav-btn:focus {
        outline: none;
        border-color: var(--clarity-agenda-border-focus);
      }

      /* Week View - Vertical Layout */
      .agenda-week-container {
        display: flex;
        flex-direction: column;
        border: none;
      }


      /* Month View - Vertical Layout */
      .agenda-month-container {
        display: flex;
        flex-direction: column;
        border: none;
      }

      /* Day View */
      .agenda-day-container {
        border: none;
      }

      .agenda-time-slot {
        display: flex;
        min-height: 2rem;
      }

      .agenda-time-label {
        width: 4rem;
        padding: 0.25rem 0.5rem;
        background: var(--clarity-agenda-bg-secondary);
        font-size: 0.8em;
        color: var(--clarity-agenda-text-muted);
        text-align: right;
      }

      .agenda-time-content {
        flex: 1;
        padding: 0.25rem 0.5rem;
        background: var(--clarity-agenda-bg-primary);
        position: relative;
      }

      .agenda-now-marker {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--clarity-agenda-color-now);
        color: var(--clarity-agenda-color-now);
        font-size: 0.8em;
        font-weight: bold;
        padding-left: 0.5rem;
        z-index: 10;
        line-height: 1;
      }

      /* Day Element - Grid Style (legacy) */
      .agenda-day {
        background: var(--clarity-agenda-bg-primary);
        min-height: 8rem;
        display: flex;
        flex-direction: column;
      }

      .agenda-day.agenda-today {
        background: var(--clarity-agenda-bg-secondary);
        border: 2px solid var(--clarity-agenda-color-today);
      }

      .agenda-day.agenda-other-month {
        background: var(--clarity-agenda-bg-tertiary);
        opacity: 0.6;
      }

      .agenda-day-header {
        padding: var(--clarity-agenda-spacing);
        font-weight: bold;
        font-size: 0.9em;
        color: var(--clarity-agenda-text-primary);
        background: var(--clarity-agenda-bg-secondary);
      }

      .agenda-today .agenda-day-header {
        color: var(--clarity-agenda-color-today);
      }

      .agenda-day-tasks {
        flex: 1;
        padding: var(--clarity-agenda-spacing);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      /* Vertical Day Element - Org-agenda Style */
      .agenda-day-vertical {
        background: var(--clarity-agenda-bg-primary);
        padding: var(--clarity-agenda-spacing) 0;
      }

      .agenda-day-vertical.agenda-today {
        background: var(--clarity-agenda-bg-secondary);
        border-left: 3px solid var(--clarity-agenda-color-today);
        padding-left: calc(var(--clarity-agenda-spacing) - 3px);
      }

      .agenda-day-vertical.agenda-weekend {
        background: var(--clarity-agenda-bg-tertiary);
        opacity: 0.8;
      }

      .agenda-day-vertical.agenda-weekend .agenda-day-header-vertical {
        color: var(--clarity-agenda-text-muted);
      }

      .agenda-today-expanded {
        background: var(--clarity-agenda-bg-primary);
        padding: 1rem;
        margin-bottom: 2rem;
      }

      .agenda-today-expanded .agenda-day-header-vertical {
        font-size: 1.1em;
        font-weight: bold;
        margin-bottom: 1rem;
        color: var(--clarity-agenda-text-primary);
      }

      .agenda-day-header-vertical {
        font-weight: bold;
        font-size: 1em;
        color: var(--clarity-agenda-text-primary);
        margin-bottom: 0.25rem;
        padding: 0 var(--clarity-agenda-padding);
      }

      .agenda-today .agenda-day-header-vertical {
        color: var(--clarity-agenda-color-today);
      }

      .agenda-day-tasks-vertical {
        padding-left: calc(var(--clarity-agenda-padding) + 1rem);
      }

      .agenda-empty-day {
        color: var(--clarity-agenda-text-muted);
        font-style: italic;
        font-size: 0.9em;
      }

      .agenda-task-vertical {
        margin-bottom: 0.25rem;
        padding: 0.25rem 0;
      }

      .agenda-task-inline {
        margin-bottom: 0.15rem;
        font-size: 0.85em;
      }

      .agenda-untimed-tasks {
        margin-top: 1rem;
        padding-top: 0.5rem;
      }


      /* Vertical Time Slots for Week/Month Views */
      .agenda-time-slot-vertical {
        display: flex;
        margin-bottom: 0.25rem;
        min-height: 1.25rem;
      }

      .agenda-time-label-vertical {
        width: 4rem;
        padding: 0.25rem 0.5rem 0.25rem 0;
        font-size: 0.8em;
        color: var(--clarity-agenda-text-muted);
        text-align: right;
        flex-shrink: 0;
      }

      .agenda-time-content-vertical {
        flex: 1;
        padding-left: 0.5rem;
        position: relative;
      }

      .agenda-now-marker-vertical {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--clarity-agenda-color-now);
        color: var(--clarity-agenda-color-now);
        font-size: 0.7em;
        font-weight: bold;
        padding-left: 0.25rem;
        z-index: 10;
        line-height: 1;
      }

      .agenda-task-inline-vertical {
        margin-bottom: 0.15rem;
        padding: 0.05rem 0;
        font-size: 0.8em;
      }

      .agenda-untimed-tasks-vertical {
        margin-top: 0.5rem;
        padding-top: 0.5rem;
      }

      .agenda-untimed-tasks-bottom {
        margin-top: 0.75rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--clarity-agenda-border);
      }


      .agenda-empty-time-slot {
        height: 1rem;
        opacity: 0.3;
      }

      /* Task Element */
      .agenda-task {
        padding: 0.25rem 0.5rem;
        border-radius: var(--clarity-agenda-border-radius);
        cursor: pointer;
        transition: background-color var(--clarity-agenda-transition-duration) ease;
        font-size: 0.85em;
        line-height: 1.3;
      }

      .agenda-task:hover {
        background: var(--clarity-agenda-hover);
      }

      .agenda-task-priority {
        /* Priority tasks no longer have bold styling */
      }


      .agenda-task-completed {
        opacity: 0.6;
      }

      .agenda-task-completed .agenda-task-text {
        text-decoration: line-through;
        color: var(--clarity-agenda-color-done);
      }

      .agenda-task-content {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem;
      }

      .agenda-task-status {
        color: var(--clarity-agenda-color-todo);
        font-size: 0.8em;
      }

      .agenda-task-priority {
        color: var(--clarity-agenda-color-priority);
        font-size: 0.8em;
        font-weight: normal;
        font-style: normal;
      }

      .agenda-task-blocked {
        color: var(--clarity-agenda-color-blocked);
        font-size: 0.8em;
        font-weight: normal;
        font-style: normal;
      }


      .agenda-task-text {
        color: var(--clarity-agenda-text-primary);
      }

      .agenda-task.completed .agenda-task-text {
        color: var(--clarity-agenda-color-done);
        text-decoration: line-through;
      }

      .agenda-task.completed .agenda-task-status {
        color: var(--clarity-agenda-color-done);
      }

      .agenda-task-time {
        color: var(--clarity-agenda-text-secondary);
        font-size: 0.8em;
      }

      .agenda-task-schedule {
        color: var(--clarity-agenda-text-secondary);
        font-size: 0.8em;
      }

      .agenda-task-due {
        color: var(--clarity-agenda-text-secondary);
        font-size: 0.8em;
      }

      .agenda-task-meta {
        color: var(--clarity-agenda-text-muted);
        font-size: 0.8em;
      }


      .agenda-task-completed-at {
        color: var(--clarity-agenda-color-done);
        font-size: 0.8em;
        font-style: italic;
      }

      .agenda-task-overdue-info {
        color: #dc3545;
        font-size: 0.8em;
      }

      .agenda-overdue-tasks {
        margin-top: 1rem;
        padding-top: 0.5rem;
      }

      .agenda-upcoming-tasks {
        margin-top: 1rem;
        padding-top: 0.5rem;
      }

      /* Section Headers */
      .agenda-section-header {
        font-weight: bold;
        font-size: 1.1em;
        color: var(--clarity-agenda-text-primary);
        margin: 1rem 0 0.5rem 0;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--clarity-agenda-border);
      }


      /* All Tasks Section */
      .agenda-all-tasks-section {
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid var(--clarity-agenda-border);
      }

      .agenda-all-tasks-container {
        padding-left: 0.5rem;
      }

      .agenda-task-all {
        margin-bottom: 0.25rem;
        padding: 0.25rem 0;
      }


      /* Responsive Design */
      @media (max-width: 768px) {
        .agenda-header {
          flex-direction: column;
          gap: 0.5rem;
          text-align: center;
        }

        .agenda-controls {
          align-items: center;
        }

        .agenda-view-toggles {
          flex-wrap: wrap;
          justify-content: center;
        }

        .agenda-view-btn {
          font-size: 0.8em;
          padding: 0.2rem 0.5rem;
        }

        .agenda-day {
          min-height: 6rem;
        }

        .agenda-day-tasks-vertical {
          padding-left: var(--clarity-agenda-padding);
        }

        .agenda-time-label {
          width: 3rem;
          font-size: 0.75em;
        }

        .agenda-time-label-vertical {
          width: 3rem;
          font-size: 0.7em;
        }

        .agenda-task-inline-vertical {
          font-size: 0.8em;
        }

        .agenda-task {
          font-size: 0.8em;
        }
      }

      @media (max-width: 480px) {
        .agenda-nav {
          flex-direction: column;
          width: 100%;
        }

        .agenda-nav-btn {
          padding: 0.5rem;
        }
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Register the web component
customElements.define('clarity-agenda', AgendaElement);

// Make classes available globally for testing and direct usage
if (typeof window !== 'undefined') {
  window.Agenda = Agenda;
  window.AgendaElement = AgendaElement;
}

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Agenda, AgendaElement };
}
