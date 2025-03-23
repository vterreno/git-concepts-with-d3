define(['historyview', 'controlbox', 'filebox', 'd3'], function (HistoryView, ControlBox, FileBox, d3) {
    var prefix = 'ExplainGit',
        openSandBoxes = [],
        open,
        reset,
        explainGit;

    open = function (_args) {
        var args = Object.create(_args),
            name = prefix + args.name,
            containerId = name + '-Container',
            container = d3.select('#' + containerId),
            playground = container.select('.playground-container'),
            historyView, originView = null,
            controlBox, fileBox;

        container.style('display', 'block');

        args.name = name;
        args = JSON.parse(JSON.stringify(_args));
        historyView = new HistoryView(args);

        if (args.originData) {
            originView = new HistoryView({
                name: name + '-Origin',
                width: 300,
                height: 295,
                commitRadius: 15,
                remoteName: 'origin',
                commitData: JSON.parse(JSON.stringify(args.originData))
            });
            
            originView.render(playground);
        }

        fileBox = new FileBox({
            controlBox: controlBox,
        });

        controlBox = new ControlBox({
            historyView: historyView,
            originView: originView,
            initialMessage: args.initialMessage,
            previousHash: args.previousHash,
            workingDirectory: fileBox.workingDirectory 
        });

        fileBox.render(playground);
        controlBox.render(playground);
        historyView.render(playground);

        openSandBoxes.push({
            hv: historyView,
            cb: controlBox,
            ov: originView,
            fb: fileBox,
            container: container
        });
    };

    reset = function () {
        for (var i = 0; i < openSandBoxes.length; i++) {
            var osb = openSandBoxes[i];
            osb.hv.destroy();
            osb.ov && osb.ov.destroy();
            osb.cb.destroy();
            osb.fb.destroy();
            osb.container.style('display', 'none');
        }

        openSandBoxes.length = 0;
        d3.selectAll('a.openswitch').classed('selected', false);
    };

    explainGit = {
        HistoryView: HistoryView,
        ControlBox: ControlBox,
        FileBox: FileBox,
        generateId: HistoryView.generateId,
        open: open,
        reset: reset
    };

    window.explainGit = explainGit;

    return explainGit;
});