// Variables for managing state
let alphabet = [];

// The set of starting element
let S = new Set();
S.add("ε");

let E = new Set();
E.add("ε");

let memoized_words = {};
let rows = {};

function concat_words(a, b) {
    if (a == "ε") 
	return b;
    else {
	if (b == "ε") {
	    return a;
	} else {
	    return word = a+b;
	}
    }
}

function compareRows(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function first_difference(a, b) {
    var i = 0;
    for (; i < a.length; ++i) {
	if (a[i] !== b[i])
	    break;
    }
    for (const e of E) {
	if (i == 0)
	    return e;
	i--;
    }
}

async function ask_for_T(word) {
    const questionElement = document.getElementById('question');

    question = 'Is the word "' + word + '" inside your langage?';
    questionElement.textContent = question;

    // Force a small delay to ensure the DOM update is rendered
    await new Promise(resolve => setTimeout(resolve, 0));

    
    return new Promise((contained) => {
	// Attach event listeners for "Yes" and "No" buttons
	const yesButton = document.getElementById('yesButton');
	const noButton = document.getElementById('noButton');

	function handleYesClick() {
	    // Resolve the promise to "wake up" the awaiting function
	    contained(true);
	    // Clean up event listener after use
	    yesButton.removeEventListener('click', handleYesClick);
	    noButton.removeEventListener('click', handleNoClick);
	}

	function handleNoClick() {
	    // Resolve the promise to "wake up" the awaiting function
	    contained(false);
	    // Clean up event listener after use
	    yesButton.removeEventListener('click', handleYesClick);
	    noButton.removeEventListener('click', handleNoClick);
	};
		      
	
	yesButton.addEventListener('click', handleYesClick);
	noButton.addEventListener('click', handleNoClick);
    })
}


// A function returning 1 iff T(s.e) \in L
// It uses previous knowledge or asks the user if it doesn't know yet
async function T(s, e) {
    let word = concat_words(s, e)
    if (! (word in memoized_words)) 
	memoized_words[word] = await ask_for_T(word);
    
    return memoized_words[word];
}

async function constructGraphAutomaton() {
    let nodes = {};
    for (const s of S) {
	if (! (rows[s] in nodes)) {
	    nodes[rows[s]] = {
		"accepting" : await T(s,"ε"),
		"start" : s
	    }
	}
    }
    let graph = 'digraph finite_state_machine {\n\trankdir=LR;\n\tsize="8,5"\n\t"i" [style=invis];\n'

    for (var node in nodes) {
	let accepting = nodes[node]["accepting"];
	let start = nodes[node]["start"];
	if (accepting)
	    graph += '\t"'+node+'" [shape = doublecircle];\n';
	else
	    graph += '\t"'+node+'" [shape = circle];\n';

	for (const a of alphabet) {
	    graph += '\t "' + node + '" -> "' + rows[concat_words(start, a)] + '" [ label = "' + a + '"];\n';
	}
    }
     graph += '\t "i" -> "' + rows["ε"] + '";\n';
    
    graph += "}";
    
    return graph;
}


// Function to render a graph using Graphviz's DOT syntax
function renderGraph(dotData) {
    const viz = new Viz();
    viz.renderSVGElement(dotData)
	.then(function(element) {
	    const graphDiv = document.getElementById('graph');
	    graphDiv.innerHTML = '';
	    graphDiv.appendChild(element);
	})
	.catch(error => {
	    console.error(error);
	});
}

// Wether the current rows describe a closed observation tables
//   It returns null if the table is closed
//   ... else it returns a counter example of the form s.a
function is_closed() {
    for (const s of S) {
	for (const a of alphabet) {
	    let closed = false;
	    for (const t of S) {
		if (compareRows(rows[concat_words(s,a)], rows[t])) {
		    closed = true;
		    break;
		}
	    }
	    if (! closed)
		return concat_words(s,a);
	}
    }
    return null;
}

function is_consistent() {
    for (const s1 of S) {
	for (const s2 of S) {
	    if (s1 == s2)
		continue;
	    if (!compareRows(rows[s1], rows[s2]))
		continue;

	    for (const a of alphabet) {
		if (!compareRows(rows[concat_words(s1, a)], rows[concat_words(s2, a)])) {
		    return {
			"s1" : s1,
			"s2" : s2,
			"a" : a,
			"e" : first_difference(rows[concat_words(s1, a)], rows[concat_words(s2, a)])
		    }
		}
	    }
	}
    }
    return null;
}

async function compute_rows() {
    rows = {};
    for (const s of S) {
	rows[s] = [];
	for (const e of E) {
	    rows[s].push(await T(s,e));
	}
	for (const a of alphabet) {
	    rows[concat_words(s,a)] = [];
	    for (const e of E) {
		rows[concat_words(s,a)].push(await T(concat_words(s,a),e));
	    }
	}
    }
}

async function L_star_algorithm() {

    await compute_rows();
    let unclosed_example = is_closed();
    let unconsistent_example = is_consistent();
    while (unclosed_example != null || unconsistent_example != null) {
	await compute_rows();
	unconsistent_example = is_consistent();
	unclosed_example = is_closed();
	if (unconsistent_example != null) {
	    E.add(concat_words(unconsistent_example["a"], unconsistent_example["e"]));
	    continue;
	}
	if (unclosed_example != null) {
	    S.add(unclosed_example);
	    continue;
	}	
    }
    let automaton_guess = await constructGraphAutomaton();
    document.getElementById('question-section').classList.add('hidden');
    document.getElementById('automaton').classList.remove('hidden');
    renderGraph(automaton_guess);
}

// Function to handle alphabet submission
document.getElementById('submitAlphabet').addEventListener('click', function() {
    const alphabetInput = document.getElementById('alphabet').value;
    alphabet = alphabetInput.split(',').map(letter => letter.trim()).filter(Boolean); // Filter out empty strings
    

    if (alphabet.length > 0) {
	document.getElementById('alphabet-input').classList.add('hidden');
	document.getElementById('question-section').classList.remove('hidden');

	L_star_algorithm();
	
    } else {
	alert("Your alphabet is empty!");
    }
});

document.getElementById('submitCounterexample').addEventListener('click', function() {

    document.getElementById('question-section').classList.remove('hidden');
    document.getElementById('automaton').classList.add('hidden');

    const cexInput = document.getElementById('counterexample').value;
    const cexLenght = cexInput.length;

    for (var i = 1; i <= cexLenght; i++) {
	S.add(cexInput.substring(0, i));
    }

    L_star_algorithm();
    
});

// Function to ask the current question
function askQuestion() {
    const questionElement = document.getElementById('question');
    if (currentQuestionIndex < questions.length) {
	questionElement.textContent = questions[currentQuestionIndex];
    } else {
	document.getElementById('question-section').classList.add('hidden');
	document.getElementById('automaton').classList.remove('hidden');
	renderGraph(automatonGraphData); // Display automaton after questions
    }
}


