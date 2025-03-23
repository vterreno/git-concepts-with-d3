define(['d3'], function () {
    "use strict";

    /**
     * @class ControlBox
     * @constructor
     */
    function ControlBox(config) {
        this.historyView = config.historyView;
        this.originView = config.originView;
        this.initialMessage = config.initialMessage || 'Ingrese un comando de git';
        this._commandHistory = [];
        this._currentCommand = -1;
        this._tempCommand = '';
        this.stagingArea = [];
        this.workingDirectory = config.workingDirectory || []; 
        this.tags = [];
        this.previousHash = config.previousHash;
        this.rebaseConfig = {}; // to configure branches for rebase
    }

    ControlBox.prototype = {
        render: function (container) {
            var cBox = this,
                cBoxContainer, log, input;

            cBoxContainer = container.append('div')
                .classed('control-box', true);

            log = cBoxContainer.append('div')
                .classed('log', true);

            input = cBoxContainer.append('input')
                .attr('type', 'text')
                .attr('placeholder', 'Comando de git');

            input.on('keyup', function () {
                var e = d3.event;

                switch (e.keyCode) {
                    case 13:
                        if (this.value.trim() === '') {
                            break;
                        }

                        cBox._commandHistory.unshift(this.value);
                        cBox._tempCommand = '';
                        cBox._currentCommand = -1;
                        cBox.command(this.value);
                        this.value = '';
                        e.stopImmediatePropagation();
                        break;
                    case 38:
                        var previousCommand = cBox._commandHistory[cBox._currentCommand + 1];
                        if (cBox._currentCommand === -1) {
                            cBox._tempCommand = this.value;
                        }

                        if (typeof previousCommand === 'string') {
                            cBox._currentCommand += 1;
                            this.value = previousCommand;
                            this.value = this.value; // set cursor to end
                        }
                        e.stopImmediatePropagation();
                        break;
                    case 40:
                        var nextCommand = cBox._commandHistory[cBox._currentCommand - 1];
                        if (typeof nextCommand === 'string') {
                            cBox._currentCommand -= 1;
                            this.value = nextCommand;
                            this.value = this.value; // set cursor to end
                        } else {
                            cBox._currentCommand = -1;
                            this.value = cBox._tempCommand;
                            this.value = this.value; // set cursor to end
                        }
                        e.stopImmediatePropagation();
                        break;
                }
            });

            this.container = cBoxContainer;
            this.log = log;
            this.input = input;

            this.info(this.initialMessage);
        },

        destroy: function () {
            this.log.remove();
            this.input.remove();
            this.container.remove();

            for (var prop in this) {
                if (this.hasOwnProperty(prop)) {
                    this[prop] = null;
                }
            }
        },

        _scrollToBottom: function () {
            var log = this.log.node();
            log.scrollTop = log.scrollHeight;
        },

        command: function (entry) {
            if (entry.trim === '') {
                return;
            }

            var split = entry.split(' ');

            if (split[0].toLowerCase() === 'clear') {
                return this.log.html('');
            }

            if (split[0].toLowerCase() === 'exit') {
                document.getElementById('ExplainGitZen-Container').style.display = 'none';
                history.replaceState(null, "", window.location.pathname + window.location.search);
                
                if (this.previousHash !== '') {
                    let link = 'open-' + this.previousHash
                    document.getElementById(link).click();
                }
            }

            this.log.append('div')
                .classed('command-entry', true)
                .html(entry);

            this._scrollToBottom();

            if (split[0] !== 'git') {
                return this.error();
            }

            var method = split[1],
                args = split.slice(2);

            try {
                if (typeof this[method] === 'function') {
                    this[method](args);
                } else {
                    this.error();
                }
            } catch (ex) {
                var msg = (ex && ex.message) ? ex.message : null;
                this.error(msg);
            }
        },

        init: function (directory) {
            this.info(this.initialMessage);
            if (directory == '' || directory == null) {
                this.info('Repositorio de Git inicializado en /git-visual/.git/ (directorio actual)');
            } else {
                this.info('Repositorio de Git inicializado en /' + directory + '/.git/');
            }

            this.info(`$ tree .git
                ├── HEAD
                ├── config
                ├── description
                ├── hooks
                │   ├── applypatch-msg.sample
                │   ├── commit-msg.sample
                │   ├── fsmonitor-watchman.sample
                │   ├── post-update.sample
                │   ├── pre-applypatch.sample
                │   ├── pre-commit.sample
                │   ├── pre-merge-commit.sample
                │   ├── pre-push.sample
                │   ├── pre-rebase.sample
                │   ├── pre-receive.sample
                │   ├── prepare-commit-msg.sample
                │   ├── push-to-checkout.sample
                │   └── update.sample
                ├── info
                │   └── exclude
                ├── objects
                │   ├── info
                │   └── pack
                └── refs
                    ├── heads
                    └── tags
                
                9 directories, 17 files`);

        },

        info: function (msg) {
            this.log.append('div').classed('info', true).html(`<pre style="white-space: pre-wrap; font-family: monospace; font-size: 13px">${msg}</pre>`);;
            this._scrollToBottom();
        },

        error: function (msg) {
            if (msg == "Cannot read properties of null (reading 'parent')") return;
            msg = msg || 'Comando no reconocido';
            this.log.append('div').classed('error', true).html(msg);
            this._scrollToBottom();
        },

        add: function (args) {
            if (args.length < 1) {
                this.info(
                    'Por favor provee un nombre de archivo o un punto ' +
                    'para agregar todos los archivos al staging area.'
                );
                return;
            }

            // Si se ingresa ".", agregamos todos los archivos no trackeados del directorio de trabajo
            if (args[0] === '.') {
                if (this.workingDirectory.length === 0) {
                    this.info('No hay archivos en el directorio de trabajo para agregar.');
                    return;
                }
                this.workingDirectory.forEach(file => {
                    if (this.stagingArea.indexOf(file) === -1) {
                        this.stagingArea.push(file);
                    }
                });
                return;
            }

            // Agregar archivo individual si existe en el directorio de trabajo
            const file = args[0];
            const fileObjWorkingDirectory = this.workingDirectory.find(f => f.name === file);
            if (!fileObjWorkingDirectory) {
                this.info('El archivo "' + file + '" no existe en el directorio de trabajo.');
                return;
            }
            
            // Verificar si ya está en el stagingArea
            const fileObjStagingArea = this.stagingArea.find(f => f.name === file);
            if (!fileObjStagingArea) {
                this.stagingArea.push(fileObjWorkingDirectory);
            }
        },

        unstage: function (args) {
            if (args.length < 1) {
                this.info('Debes indicar un archivo para deshacer el git add.');
                return;
            }
            const file = args[0];
            const index = this.stagingArea.indexOf(file);
            if (index !== -1) {
                this.stagingArea.splice(index, 1);
                this.info(file + ' ha sido removido del staging area.');
            } else {
                this.info(file + ' no está en el staging area.');
            }
        },

        commit: function (args) {
            if (this.stagingArea.length === 0) {
                this.info(
                    'No hay nada en el staging area para commitear. ' +
                    'Por favor agrega archivos al staging area antes de commitear.'
                );
                return;
            }
            // Realizar el commit
            if (args.length >= 2) {
                var arg = args.shift();
                switch (arg) {
                    case '-m':
                        var message = args.join(" ");
                        this.historyView.commit({ files: this.stagingArea.slice() }, message);
                        break;
                    default:
                        this.historyView.commit({ files: this.stagingArea.slice() });
                        break;
                }
            } else {
                this.historyView.commit({ files: this.stagingArea.slice() });
            }
            // Marcar cada archivo del stagingArea como comiteado en el workingDirectory
            this.stagingArea.forEach(function (fileName) {
                var fileObj = this.workingDirectory.find(function (obj) {
                    return obj.name === fileName.name;
                });
                if (fileObj) {
                    fileObj.commit = true;
                }
            }, this);

            this.stagingArea = [];
        },

        branch: function (args) {
            if (args.length < 1) {
                this.info(
                    'Tienes que darle un nombre a la rama ' +
                    'Normalmente si no le das un nombre, ' +
                    'este comando te mostrará una lista de todas tus ramas locales en pantalla.'
                );

                return;
            }

            while (args.length > 0) {
                var arg = args.shift();

                switch (arg) {
                    case '--remote':
                    case '-r':
                        this.info(
                            'Este comando normalmente muestra todas tus ramas remotas.'
                        );
                        args.length = 0;
                        break;
                    case '--all':
                    case '-a':
                        this.info(
                            'Este comando normalmente muestra todas tus ramas locales y remotas.'
                        );
                        break;
                    case '--delete':
                    case '-d':
                        var name = args.pop();
                        this.historyView.deleteBranch(name);
                        break;
                    default:
                        if (arg.charAt(0) === '-') {
                            this.error();
                        } else {
                            var remainingArgs = [arg].concat(args);
                            args.length = 0;
                            this.historyView.branch(remainingArgs.join(' '));
                        }
                }
            }
        },

        checkout: function (args) {
            while (args.length > 0) {
                var arg = args.shift();

                switch (arg) {
                    case '-b':
                        var name = args[args.length - 1];
                        try {
                            this.historyView.branch(name);
                        } catch (err) {
                            if (err.message.indexOf('ya existe') === -1) {
                                throw new Error(err.message);
                            }
                        }
                        break;
                    default:
                        var remainingArgs = [arg].concat(args);
                        args.length = 0;
                        this.historyView.checkout(remainingArgs.join(' '));
                }
            }
        },

        clone: function (args) {
            if (args.length < 1) {
                this.info('Por favor provee una URL de un repositorio para clonar.');
                return;
            }

            const repo_url = args[0];
            const project_name = repo_url.substring(repo_url.lastIndexOf('/') + 1);

            let directory_name = null;

            for (let i = 1; i < args.length; i++) {
                if (!args[i].startsWith("--")) {
                    directory_name = args[i];
                    break;
                }
            }

            if (!directory_name) {
                directory_name = project_name;
            }

            this.info("Clonando " + project_name + " en '/Users/proyectos/" + directory_name + "/'...");
            this.info("remote: Enumerating objects: 3, done.");
            this.info("remote: Counting objects: 100% (3/3), done.");
            this.info("remote: Compressing objects: 100% (2/2), done.");
            this.info("remote: Total 3 (delta 0), reused 0 (delta 0), pack-reused 0");
            this.info("Desempaquetando objetos: 100% (3/3), listo.");
            this.info("Clonado en '/Users/proyectos/" + directory_name + "/'");
        },

        status: function (args) {
            this.previousHash = window.location.hash
            let message = 'On branch master\n\n';
            let flag = false;
            let count = 0;

            this.workingDirectory.forEach(file => {
                if (file.commit == true) {
                    count++
                }
            });

            if (count == this.workingDirectory.length) {
                flag = true;
            }

            if (this.stagingArea.length > 0 && flag === false) {
                if (args[0] == '--short' || args[0] == '-s') {
                    message = message == 'On branch master\n\n' ? '' : message;
                    this.stagingArea.forEach(file => {
                        if (file.commit == false) {
                            message += 'A ' + file.name + '\n';
                        } 
                    });
                } else {
                    message += 'Changes to be committed:\n';
                    this.stagingArea.forEach(file => {
                        if (file.commit == false) {
                            message += '  new file:   ' + file.name + '\n';
                        } 
                    });
                    message += '\n';
                }
            }
            // Simulamos los archivos en el directorio de trabajo que no están en staging area
            const untracked = this.workingDirectory.filter(file => this.stagingArea.indexOf(file) === -1);
            if (untracked.length > 0 && flag === false) {
                if (args[0] == '--short' || args[0] == '-s') {
                    message == 'On branch master\n\n' ? '' : message;
                    untracked.forEach(file => {
                        if (file.commit == false) {
                            message += '?? ' + file.name + '\n';
                        }
                    });
                    message += '\n';
                } else {
                    message += 'Untracked files:\n';
                    message += '(use "git add <file>..." to include in what will be committed)\n';
                    untracked.forEach(file => {
                        if (file.commit == false ){
                            message += '  ' + file.name + '\n';
                        }
                    });
                    message += '\n';
                    message += 'no changes added to commit (use "git add" and/or "git commit -a")\n';
                    message += '\n';
                }
            } else {
                message += 'nothing to commit, working tree clean\n';
            }
            this.info(message);
        },

        tag: function (args) {
            if (args.length < 1) {
                this.info(
                    'Necesitas dar un nombre a tu tag. ' +
                    'Normalmente si no se provee un nombre, ' +
                    'este comando te mostrará una lista de tus tags locales en pantalla.'
                );

                return;
            }

            // Tag anotado
            if (args[0] === '-a') {
                let tagName = args[1];
                let tagMessage = args[2] == '-m' ? args.slice(3).join(' ').replace(/^["']+|["']+$/g, '') : '';
                let flagCommit = false;
                let tag = {
                    name: tagName,
                    message: tagMessage,
                    isLightweight: false,
                }
                if (args[2] && args[2] != '-m') {
                    tag.commit = args[2];
                    flagCommit = true;
                } else {
                    tag.commit = this.historyView.getCommit('HEAD').id
                }
            
                try {
                    if (flagCommit) {
                        this.historyView.getCommit(tag.commit).tags.push("[" + tag.name + "]");
                        this.historyView.renderTags();
                    } else {
                        this.historyView.tag(tag.name);
                    }
                    
                } catch (err) {
                    if (err.message.indexOf('ya existe') === -1) {
                        throw new Error(err.message);
                    }
                }

                this.tags.push(tag);
            } 
            else if (args[0] === '-d') {
                let tagName = args[1];
                let tag = this.tags.find(tag => tag.name === tagName);
                if (tag) {
                    this.tags = this.tags.filter(tag => tag.name !== tagName);
                    this.historyView.deleteTag(tag.commit, "[" + tagName + "]");
                } else {
                    this.info('fatal: tag ' + tagName + ' no encontrada.');
                }
            } // Tag ligero
            else {
                let tagName = args[0];
                let tag = {
                    name: tagName,
                    isLightweight: true,
                    commit: this.historyView.getCommit('HEAD').id
                }

                try {
                    this.historyView.tag(tag.name);
                } catch (err) {
                    if (err.message.indexOf('ya existe') === -1) {
                        throw new Error(err.message);
                    }
                }

                this.tags.push(tag);
            }
        },

        show: function (args) {
            if (args.length < 1) {
                this.info(
                    'Por favor provee un tag, commit o branch para mostrar.'
                );
                return;
            }

            let ref = args[0];
            let commit = this.historyView.getCommit(ref);
            
            if (commit && this.tags.find(tag => tag.name === ref) == undefined) {
                this.info("commit: " + commit.id + "..." + "\n");
                this.info("Author: John Doe <johndoe@gmail.com>\n");
                this.info("Date: Fri Mar 21 20:28:32 2025 -0300 \n\n");
                if (commit.message != undefined) {
                    this.info("  " + commit.message);
                }
            } else {
                let tag = this.tags.find(tag => tag.name === ref);
                
                if (tag) {
                    if (tag.isLightweight === false) {
                        this.info("tag " + tag.name + "\n");
                        this.info("Tagger: John Doe <johndoe@gmail.com>\n");
                        this.info("Date: Fri Mar 21 20:28:32 2025 -0300 \n\n");
                        this.info(tag.message);
                    }
                    this.info("commit: " + tag.commit + "..." + "\n");
                    this.info("Author: John Doe <johndoe@gmail.com>\n");
                    this.info("Date: Fri Mar 21 20:28:32 2025 -0300 \n\n");

                    commit = this.historyView.getCommit(tag.commit);
                    if (commit.message != undefined) {
                        this.info("  " + commit.message);
                    }
                } else {
                    this.info('fatal: referencia no encontrada: ' + ref);
                }
            }
        },

        reset: function (args) {
            while (args.length > 0) {
                var arg = args.shift();

                switch (arg) {
                    case '--soft':
                        this.info(
                            'La bandera "--soft" funciona en el git real, pero ' +
                            'no es posible mostrarlo como funciona en esta demo. ' +
                            'Por ende, vamos a ver como funciona el "--hard" en cambio.'
                        );
                        break;
                    case '--mixed':
                        this.info(
                            'La bandera "--mixed" funciona en el git real, pero ' +
                            'no es posible mostrarlo en esta demo.'
                        );
                        break;
                    case '--hard':
                        this.historyView.reset(args.join(' '));
                        args.length = 0;
                        break;
                    default:
                        var remainingArgs = [arg].concat(args);
                        args.length = 0;
                        this.info('Asumiendo "--hard".');
                        this.historyView.reset(remainingArgs.join(' '));
                }
            }
        },

        clean: function (args) {
            this.info('Borrando todos tus archivos no seguidos...');
        },

        revert: function (args) {
            this.historyView.revert(args.shift());
        },

        merge: function (args) {
            var noFF = false;
            var branch = args[0];
            if (args.length === 2) {
                if (args[0] === '--no-ff') {
                    noFF = true;
                    branch = args[1];
                } else if (args[1] === '--no-ff') {
                    noFF = true;
                    branch = args[0];
                } else {
                    this.info('Esta demo solamente soporta --no-ff..');
                }
            }
            var result = this.historyView.merge(branch, noFF);

            if (result === 'Fast-Forward') {
                this.info('Haz realizado un fast-forward merge.');
            }
        },

        rebase: function (args) {
            var ref = args.shift(),
                result = this.historyView.rebase(ref);

            if (result === 'Fast-Forward') {
                this.info('Fast-forwarded to ' + ref + '.');
            }
        },

        fetch: function () {
            if (!this.originView) {
                throw new Error('No hay un servidor remoto para realizar el fetch.');
            }

            var origin = this.originView,
                local = this.historyView,
                remotePattern = /^origin\/([^\/]+)$/,
                rtb, isRTB, fb,
                fetchBranches = {},
                fetchIds = [], // just to make sure we don't fetch the same commit twice
                fetchCommits = [], fetchCommit,
                resultMessage = '';

            // determine which branches to fetch
            for (rtb = 0; rtb < local.branches.length; rtb++) {
                isRTB = remotePattern.exec(local.branches[rtb]);
                if (isRTB) {
                    fetchBranches[isRTB[1]] = 0;
                }
            }

            // determine which commits the local repo is missing from the origin
            for (fb in fetchBranches) {
                if (origin.branches.indexOf(fb) > -1) {
                    fetchCommit = origin.getCommit(fb);

                    var notInLocal = local.getCommit(fetchCommit.id) === null;
                    while (notInLocal) {
                        if (fetchIds.indexOf(fetchCommit.id) === -1) {
                            fetchCommits.unshift(fetchCommit);
                            fetchIds.unshift(fetchCommit.id);
                        }
                        fetchBranches[fb] += 1;
                        fetchCommit = origin.getCommit(fetchCommit.parent);
                        notInLocal = local.getCommit(fetchCommit.id) === null;
                    }
                }
            }

            // add the fetched commits to the local commit data
            for (var fc = 0; fc < fetchCommits.length; fc++) {
                fetchCommit = fetchCommits[fc];
                local.commitData.push({
                    id: fetchCommit.id,
                    parent: fetchCommit.parent,
                    tags: []
                });
            }

            // update the remote tracking branch tag locations
            for (fb in fetchBranches) {
                if (origin.branches.indexOf(fb) > -1) {
                    var remoteLoc = origin.getCommit(fb).id;
                    local.moveTag('origin/' + fb, remoteLoc);
                }

                resultMessage += 'Haz traido ' + fetchBranches[fb] + ' commits de ' + fb + '.</br>';
            }

            this.info(resultMessage);

            local.renderCommits();
        },

        pull: function (args) {
            var control = this,
                local = this.historyView,
                currentBranch = local.currentBranch,
                rtBranch = 'origin/' + currentBranch,
                isFastForward = false;

            this.fetch();

            if (!currentBranch) {
                throw new Error('Actualmente no estas en una rama.');
            }

            if (local.branches.indexOf(rtBranch) === -1) {
                throw new Error('La rama actual no esta seteada para pullear.');
            }

            setTimeout(function () {
                try {
                    if (args[0] === '--rebase' || control.rebaseConfig[currentBranch] === 'true') {
                        isFastForward = local.rebase(rtBranch) === 'Fast-Forward';
                    } else {
                        isFastForward = local.merge(rtBranch) === 'Fast-Forward';
                    }
                } catch (error) {
                    control.error(error.message);
                }

                if (isFastForward) {
                    control.info('Fast-forwarded a ' + rtBranch + '.');
                }
            }, 750);
        },

        push: function (args) {
            var control = this,
                local = this.historyView,
                remoteName = args.shift() || 'origin',
                remote = this[remoteName + 'View'],
                branchArgs = args.pop(),
                localRef = local.currentBranch,
                remoteRef = local.currentBranch,
                localCommit, remoteCommit,
                findCommitsToPush,
                isCommonCommit,
                toPush = [];

            if (remoteName === 'history') {
                throw new Error('Disculpa, no puedes tener un remoto llamado "history" en este ejemplo.');
            }

            if (!remote) {
                throw new Error('No hay un server remoto llamado: "' + remoteName + '".');
            }

            if (branchArgs) {
                branchArgs = /^([^:]*)(:?)(.*)$/.exec(branchArgs);

                branchArgs[1] && (localRef = branchArgs[1]);
                branchArgs[2] === ':' && (remoteRef = branchArgs[3]);
            }

            if (local.branches.indexOf(localRef) === -1) {
                throw new Error('Local ref: ' + localRef + ' no existe.');
            }

            if (!remoteRef) {
                throw new Error('No se ha especificado una rama remota para pushear.');
            }

            localCommit = local.getCommit(localRef);
            remoteCommit = remote.getCommit(remoteRef);

            findCommitsToPush = function findCommitsToPush(localCommit) {
                var commitToPush,
                    isCommonCommit = remote.getCommit(localCommit.id) !== null;

                while (!isCommonCommit) {
                    commitToPush = {
                        id: localCommit.id,
                        parent: localCommit.parent,
                        tags: []
                    };

                    if (typeof localCommit.parent2 === 'string') {
                        commitToPush.parent2 = localCommit.parent2;
                        findCommitsToPush(local.getCommit(localCommit.parent2));
                    }

                    toPush.unshift(commitToPush);
                    localCommit = local.getCommit(localCommit.parent);
                    isCommonCommit = remote.getCommit(localCommit.id) !== null;
                }
            };

            // push to an existing branch on the remote
            if (remoteCommit && remote.branches.indexOf(remoteRef) > -1) {
                if (!local.isAncestor(remoteCommit.id, localCommit.id)) {
                    throw new Error('Push rechazado. Non fast-forward.');
                }

                isCommonCommit = localCommit.id === remoteCommit.id;

                if (isCommonCommit) {
                    return this.info('Todo esta actualizado.');
                }

                findCommitsToPush(localCommit);

                remote.commitData = remote.commitData.concat(toPush);
                remote.moveTag(remoteRef, toPush[toPush.length - 1].id);
                remote.renderCommits();
            } else {
                // TO-DO: git push -u origin nombre-de-la-rama
                this.info('Disculpa, crear nuevas ramas remotas no esta permitido todavia.');
            }
        },

        config: function (args) {
            var path = args.shift().split('.');

            if (path[0] === 'branch') {
                if (path[2] === 'rebase') {
                    this.rebase[path[1]] = args.pop();
                }
            }
        },
    };

    return ControlBox;
});
