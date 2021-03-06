'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';
import { sleep } from './helpers';

describe('Linter Integration', () => {
  let directory = null;
  let workspaceElement = null;
  let dummyPackage = null;
  const join = require('path').join;

  temp.track();

  beforeEach(() => {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' }));
    atom.project.setPaths([ directory ]);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.scrollOnError', false);
    atom.config.set('build.notificationOnRefresh', true);
    atom.config.set('editor.fontSize', 14);

    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    runs(() => {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(() => {
      return Promise.resolve()
        .then(() => atom.packages.activatePackage('build'))
        .then(() => atom.packages.activatePackage(join(__dirname, 'fixture', 'atom-build-spec-linter')))
        .then(() => (dummyPackage = atom.packages.getActivePackage('atom-build-spec-linter').mainModule));
    });
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  describe('when error matching and linter is activated', () => {
    it('should push those errors to the linter', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.json'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.error-match-multiple.json')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.json'),
            range: [ [2, 7], [2, 7] ],
            text: 'Error from build',
            type: 'Error'
          },
          {
            filePath: join(directory, '.atom-build.json'),
            range: [ [1, 4], [1, 4] ],
            text: 'Error from build',
            type: 'Error'
          }
        ]);
      });
    });

    it('should parse `message` and include that to linter', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.json'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.error-match.message.json')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.json'),
            range: [ [2, 7], [2, 7] ],
            text: 'very bad things',
            type: 'Error'
          }
        ]);
      });
    });

    it('should clear linter errors when starting a new build', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.json'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.error-match.message.json')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.json'),
            range: [ [2, 7], [2, 7] ],
            text: 'very bad things',
            type: 'Error'
          }
        ]);
        fs.writeFileSync(join(directory, '.atom-build.json'), JSON.stringify({
          cmd: `${sleep(30)}`
        }));
      });

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          !workspaceElement.querySelector('.build .title').classList.contains('error') &&
          !workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(dummyPackage.getLinter().messages.length).toEqual(0);
      });
    });
  });
});
