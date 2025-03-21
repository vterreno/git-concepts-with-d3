define(['d3'], function () {
     "use strict";

     /**
      * @class FileBox
      * @constructor
      */
     function FileBox(config) {
          this.controlBox = config.controlBox;
          this.workingDirectory = [
               { name: 'css/style.css', commit: false },
               { name: 'js/index.js', commit: false },
               { name: 'index.html', commit: false }
          ];
     }

     FileBox.prototype = {
          render: function (container) {
               var fBox = this,
                    fBoxContainer, input, titleContainer, title, buttonContainer, cleanButton;

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
                         let nombre = fBox.normalizePath(this.value.trim());
                         // Verificamos si ya existe un archivo/directorio con el mismo nombre
                         if (nombre && !fBox.workingDirectory.find(f => f.name === nombre)) {
                              fBox.workingDirectory.push({ name: nombre, commit: false });
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

               // Para cada archivo/directorio en workingDirectory se construye la estructura de árbol
               this.workingDirectory.forEach(fileObj => {
                    const path = fileObj.name;
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
                              // Si es un archivo y es el último componente, asignamos el estado de commit
                              if (isLast && type === 'file') {
                                   child.committed = fileObj.commit;
                              }
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
                         // Si el archivo ya fue comiteado, se puede aplicar una clase adicional para diferenciarlo
                         const fileSpan = nodeDiv.append('span')
                              .classed('file', true)
                              .text(node.name);
                         if (node.committed) {
                              fileSpan.classed('committed', true);
                         }
                    }
               });
          }
     };

     return FileBox;
});
