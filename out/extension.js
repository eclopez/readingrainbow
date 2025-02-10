"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const READABILITY_FORMULA_KEY = 'readingrainbow.readabilityFormula';
const DEFAULT_READABILITY_FORMULA_FUNCTION = 'colemanLiauIndex';
const readabilityFormulas = {
    // More work needed to implement the range this represents
    //automatedReadabilityIndex: { function: 'automatedReadabilityIndex', name: 'Automated Readability Index' },
    colemanLiauIndex: {
        function: DEFAULT_READABILITY_FORMULA_FUNCTION,
        name: 'Coleman-Liau Index',
    },
    daleChallReadabilityScore: {
        function: 'daleChallReadabilityScore',
        name: 'Dale-Chall Readability Score',
    },
    fleschKincaidGrade: {
        function: 'fleschKincaidGrade',
        name: 'Flesch-Kincaid Grade Level',
    },
    gunningFog: {
        function: 'gunningFog',
        name: 'The Fog Scale (Gunning FOG Formula)',
    },
    linsearWriteFormula: {
        function: 'linsearWriteFormula',
        name: 'Linsear Write Formula',
    },
    // More work needed to implement, as this needs at least 3 sentences to return a result, and more than 30 sentences to be reliable
    //smogIndex: { function: 'smogIndex', name: 'Simple Measure of Gobbledygook' },
};
const GradeLevels = {
    Kindergarten: { name: 'Kindergarten', color: '#00ff00' },
    First: { name: 'First', color: '#40ff00' },
    Second: { name: 'Second', color: '#80ff00' },
    Third: { name: 'Third', color: '#bfff00' },
    Fourth: { name: 'Fourth', color: '#ffff00' },
    Fifth: { name: 'Fifth', color: '#ffe100' },
    Sixth: { name: 'Sixth', color: '#ffc300' },
    Seventh: { name: 'Seventh', color: '#ffa500' },
    Eighth: { name: 'Eighth', color: '#ff8400' },
    Ninth: { name: 'Ninth', color: '#ff6300' },
    Tenth: { name: 'Tenth', color: '#ff4200' },
    Eleventh: { name: 'Eleventh', color: '#ff2100' },
    Twelfth: { name: 'Twelfth', color: '#ff0000' },
    Undergrad: { name: 'Undergrad', color: '#aa0055' },
    Postgrad: { name: 'Postgrad', color: '#aa0055' },
    PhD: { name: 'PhD', color: '#800080' },
};
let statusBarItem;
function getGradeLevelInfo(rawIndex) {
    switch (true) {
        case rawIndex < 1:
            return GradeLevels.Kindergarten;
        case rawIndex >= 13 && rawIndex < 17:
            return GradeLevels.Undergrad;
        case rawIndex >= 17 && rawIndex < 19:
            return GradeLevels.Postgrad;
        case rawIndex >= 19:
            return GradeLevels.PhD;
        default: {
            const gradeLevelKey = Object.keys(GradeLevels)[Math.floor(rawIndex)];
            return {
                name: `${GradeLevels[gradeLevelKey].name} grade`,
                color: GradeLevels[gradeLevelKey].color,
            };
        }
    }
}
async function updateStatusBarItem(formula) {
    try {
        const readability = await import('text-readability');
        const rs = readability.default;
        const editor = vscode.window.activeTextEditor;
        const bodyText = editor?.document.getText() ?? '';
        const readabilityFormula = Object.values(readabilityFormulas).find((f) => f.function === formula);
        let gradeLevelInfo;
        // Check if bodyText is empty before getting the grade level info to avoid unecessary calculation
        // and because the text-readability library will return `NaN` for Coleman-Liau Index if `bodyText` is empty
        // Opened PR to fix here: https://github.com/clearnote01/readability/pull/16
        if (bodyText) {
            const readabilityIndex = rs[readabilityFormula?.function](bodyText);
            gradeLevelInfo = getGradeLevelInfo(readabilityIndex);
        }
        else {
            gradeLevelInfo = { name: 'No text found', color: '#ffffff' };
        }
        if (editor?.document?.languageId === 'plaintext') {
            statusBarItem.text = gradeLevelInfo.name;
            statusBarItem.tooltip = new vscode.MarkdownString(gradeLevelInfo.name === 'No text found'
                ? `Enter some text to see the readability of this document using the ${readabilityFormula?.name}.`
                : `The document's readability is at the ${gradeLevelInfo.name} level using the ${readabilityFormula?.name}.`);
            statusBarItem.color = gradeLevelInfo.color;
            statusBarItem.command = 'readingrainbow.quickPickAction';
            statusBarItem.show();
        }
        else {
            statusBarItem.hide();
        }
    }
    catch (error) {
        console.error('Error updating status bar item:', error);
    }
}
async function activate(context) {
    const getCurrentFormula = () => context.globalState.get(READABILITY_FORMULA_KEY) ??
        DEFAULT_READABILITY_FORMULA_FUNCTION;
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
    const documentChangedEvent = vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (event.document.languageId === 'plaintext') {
            await updateStatusBarItem(getCurrentFormula());
        }
    });
    const clickCommand = vscode.commands.registerCommand('readingrainbow.quickPickAction', () => {
        vscode.window
            .showQuickPick(Object.values(readabilityFormulas).map((f) => f.name), {
            placeHolder: 'Select a formula with which to calculate readability',
        })
            .then(async (selectedFormula) => {
            if (selectedFormula) {
                const formula = Object.values(readabilityFormulas).find((f) => f.name === selectedFormula)
                    ?.function;
                context.globalState.update(READABILITY_FORMULA_KEY, formula);
                await updateStatusBarItem(formula);
            }
        });
    });
    const activeEditorChangedEvent = vscode.window.onDidChangeActiveTextEditor(async () => {
        await updateStatusBarItem(getCurrentFormula());
    });
    context.subscriptions.push(statusBarItem, documentChangedEvent, activeEditorChangedEvent, clickCommand);
    await updateStatusBarItem(getCurrentFormula());
}
function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
//# sourceMappingURL=extension.js.map