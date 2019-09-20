// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';

import { WidgetTracker, MainAreaWidget } from '@jupyterlab/apputils';

import { IConsoleTracker, ConsolePanel } from '@jupyterlab/console';

import { IStateDB } from '@jupyterlab/coreutils';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { Debugger } from './debugger';

// import { DebuggerSidebar } from './sidebar';

import { IDebugger, IDebuggerSidebar } from './tokens';

import { DebuggerNotebookTracker } from './handlers/notebook';

import { BreakpointsService, SessionTypes } from './breakpointsService';

import { DebuggerConsoleTracker } from './consoleTracker';

// import { ClientSession, IClientSession } from '@jupyterlab/apputils';

// import { DebugSession } from './session';

/**
 * The command IDs used by the debugger plugin.
 */
export namespace CommandIDs {
  export const create = 'debugger:create';

  export const debugConsole = 'debugger:debug-console';

  export const debugFile = 'debugger:debug-file';

  export const debugNotebook = 'debugger:debug-notebook';
}

// Service for controll state of breakpoints in extensione
const breakpointService = new BreakpointsService();

/**
 * A plugin that provides visual debugging support for consoles.
 */
const consoles: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/debugger:consoles',
  autoStart: true,
  requires: [IDebugger, IConsoleTracker],
  activate: (_, debug, tracker: IConsoleTracker) => {
    new DebuggerConsoleTracker({
      consoleTracker: tracker,
      breakpointService: breakpointService
    });
  }
};

/**
 * A plugin that provides visual debugging support for file editors.
 */
const files: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/debugger:files',
  autoStart: true,
  requires: [IEditorTracker],
  activate: (app: JupyterFrontEnd, tracker: IEditorTracker | null) => {
    const shell = app.shell;

    (shell as LabShell).currentChanged.connect((sender, update) => {
      const newWidget = update.newValue;
      const session =
        newWidget && (newWidget as NotebookPanel | ConsolePanel).session
          ? (newWidget as NotebookPanel | ConsolePanel).session
          : false;
      if (session) {
        breakpointService.type = session.type as SessionTypes;
      }
    });

    app.commands.addCommand(CommandIDs.debugFile, {
      execute: async _ => {
        if (!tracker || !tracker.currentWidget) {
          return;
        }
        if (tracker.currentWidget) {
          // TODO: Find if the file is backed by a kernel or attach it to one.
          const widget = await app.commands.execute(CommandIDs.create);
          app.shell.add(widget, 'main');
        }
      }
    });
  }
};

/**
 * A plugin that provides visual debugging support for notebooks.
 */
const notebooks: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlab/debugger:notebooks',
  autoStart: true,
  requires: [IDebugger],
  optional: [INotebookTracker, ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    debug,
    notebook: INotebookTracker,
    palette: ICommandPalette
  ) => {
    new DebuggerNotebookTracker({
      notebookTracker: notebook,
      breakpointService: breakpointService
    });

    // this exist only for my test in futre will be removed
    const command: string = CommandIDs.debugNotebook;
    app.commands.addCommand(command, {
      label: 'test',
      execute: () => {}
    });

    palette.addItem({ command, category: 'dev test' });
  }
};

/**
 * A plugin providing a condensed sidebar UI for debugging.
 */
const sidebar: JupyterFrontEndPlugin<Debugger> = {
  id: '@jupyterlab/debugger:sidebar',
  optional: [ILayoutRestorer],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer | null
  ): Debugger => {
    const { shell } = app;
    const label = 'Environment';
    const namespace = 'jp-debugger-sidebar';
    const sidebar = new Debugger({ breakpointsService: breakpointService });
    sidebar.id = namespace;
    sidebar.title.label = label;
    shell.add(sidebar, 'right', { activate: false });

    if (restorer) {
      restorer.add(sidebar, sidebar.id);
    }

    return sidebar;
  }
};

/**
 * A plugin providing a tracker code debuggers.
 */
const tracker: JupyterFrontEndPlugin<IDebugger> = {
  id: '@jupyterlab/debugger:tracker',
  optional: [ILayoutRestorer, IDebuggerSidebar, INotebookTracker],
  requires: [IStateDB],
  provides: IDebugger,
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    state: IStateDB,
    restorer: ILayoutRestorer | null,
    sidebar: IDebuggerSidebar | null
  ): IDebugger => {
    const tracker = new WidgetTracker<MainAreaWidget<Debugger>>({
      namespace: 'debugger'
    });
    tracker.widgetUpdated.connect((_, upadete) => {
      upadete;
    });
    app.commands.addCommand(CommandIDs.create, {
      execute: args => {
        const id = (args.id as string) || '';
        console.log(id, 'hi');
        if (id) {
          console.log('Debugger ID: ', id);
        }

        if (tracker.find(widget => id === widget.content.model.id)) {
          return;
        }

        const widget = new MainAreaWidget({
          content: new Debugger({
            connector: state,
            id: id
          })
        });

        void tracker.add(widget);

        return widget;
      }
    });

    if (restorer) {
      // Handle state restoration.
      void restorer.restore(tracker, {
        command: CommandIDs.create,
        args: widget => ({ id: widget.content.model.id }),
        name: widget => widget.content.model.id
      });
    }

    if (sidebar) {
      tracker.currentChanged.connect((_, current) => {
        sidebar.model = current ? current.content.model : null;
      });
    }

    return tracker;
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  consoles,
  files,
  notebooks,
  sidebar,
  tracker
];

export default plugins;
