define(['d3'], function () {
     "use strict";

     /**
      * @class FileBox
      * @constructor
      */
     function FileBox(config) {
          this.controlBox = config.controlBox;
          this.workingDirectory = ['css/style.css', 'js/index.js', 'index.html'];
     }

     FileBox.prototype = {
          render: function (container) {
               var fBox = this,
                    fBoxContainer, input, titleContainer, title, buttonContainer, cleanButton, exampleButton;

               fBoxContainer = container.append('div')
                    .classed('file-box', true);

               titleContainer = fBoxContainer.append('div')
                    .classed('flex justify-between items-center mb-2', true);

               title = titleContainer.append('h2')
                    .text('Directorio del proyecto')
                    .classed('text-md font-bold text-gray-800', true);

               buttonContainer = titleContainer.append('div')
                    .classed('flex', true);

               cleanButton = buttonContainer.append('button')
                    .classed('btn cursor-pointer bg-gray-500 hover:bg-gray-700 text-white text-sm py-2 px-4 rounded mr-2', true)
                    .text('Limpiar');


               // Evento para limpiar el directorio de trabajo
               cleanButton.on('click', function () {
                    fBox.workingDirectory.splice(0, fBox.workingDirectory.length);
                    fBox.updateFileTree();
                    this.value = '';
               });

               

               this.treeContainer = fBoxContainer.append('div')
                    .classed('file-tree', true);

               input = fBoxContainer.append('input')
                    .attr('type', 'text')
                    .attr('placeholder', 'Añade un archivo/directorio (ej: src/app.js o css/)');

               input.on('keyup', function () {
                    if (d3.event.keyCode === 13) { // Enter
                         let path = fBox.normalizePath(this.value.trim());
                         if (path && !fBox.workingDirectory.includes(path)) {
                              fBox.workingDirectory.push(path);
                              fBox.updateFileTree();
                              this.value = '';
                         }
                    }
               });

               this.container = fBoxContainer;
               this.input = input;
               this.updateFileTree();
          },

          destroy: function () {
               this.input.remove();
               this.container.remove();

               for (var prop in this) {
                    if (this.hasOwnProperty(prop)) {
                         this[prop] = null;
                    }
               }
          },

          normalizePath: function (path) {
               // Normalizar rutas y distinguir directorios
               const isDir = path.endsWith('/');
               path = path.replace(/^\/+|\/+$/g, ''); // Quitar slashes al inicio/final
               return isDir ? `${path}/` : path; // Conservar slash final para directorios
          },

          buildTree: function () {
               const tree = { name: '', children: [], type: 'directory' };

               this.workingDirectory.forEach(path => {
                    const parts = path.split('/').filter(p => p !== '');
                    let current = tree;
                    const isDir = path.endsWith('/');

                    parts.forEach((part, index) => {
                         const isLast = index === parts.length - 1;
                         const type = isLast && !isDir ? 'file' : 'directory';

                         let child = current.children.find(c => c.name === part);
                         if (!child) {
                              child = {
                                   name: part,
                                   type: type,
                                   children: [],
                                   path: parts.slice(0, index + 1).join('/') + (type === 'directory' ? '/' : '')
                              };
                              current.children.push(child);
                         }
                         current = child;
                    });
               });
               return tree;
          },

          updateFileTree: function () {
               const tree = this.buildTree();
               this.treeContainer.selectAll('*').remove();
               this.renderTree(this.treeContainer, tree.children);
          },

          renderTree: function (container, nodes, level = 0) {
               nodes.forEach(node => {
                    const nodeDiv = container.append('div')
                         .classed('tree-node', true)
                         .style('margin-left', `${level * 20}px`);

                    if (node.type === 'directory') {
                         nodeDiv.append('span')
                              .classed('directory', true)
                              .text(`${node.name}/`);

                         if (node.children.length > 0) {
                              const childrenContainer = nodeDiv.append('div')
                                   .classed('children', true);
                              this.renderTree(childrenContainer, node.children, level + 1);
                         }
                    } else {
                         nodeDiv.append('span')
                              .classed('file', true)
                              .text(node.name);
                    }
               });
          }
     }

     return FileBox;
});
