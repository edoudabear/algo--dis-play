// version de esgu
// Variables for managing state
let alphabet = new Set();

// The set of prefixes
let S = new Set();
S.add("ε");

// The set of suffixes
let E = new Set();
E.add("ε");

// Dictionnary containing word we already asked for
//   for each asked word it will contain true is the user answered yes, false elsewise
let memoized_words = {};

// Dictionnary representing the result of T over (S U SA, E) where A is the alphabet
//   note: is it recomputed each time in order not to bother to find where things are
//         this is not a huge issue, since everything is memoized (so no additionnal user request)
//   note2: we leverage the fact that iterating over the sets is always done in the same order
//          during an execution. Hence, rows can be stored as prefix -> bool list (the list being
//          in the order corresponding to the iteration over E).
let rows = {};

// Helper function that concatenates two words. This helps get rid of unnecessary empty words
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

// Helper function that return true iff the array a and b are the same
function compareRows(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

// Helper function that return the first suffix causing array a and b to be different
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

// Function that enumerates in a list all the words with the alphabet under a given size n
function enumerate_words(max_len) {
    if (max_len == 0)
	return new Set("ε");
    let result = new Set();
    alphabet.forEach(letter => {
	enumerate_words(max_len - 1).forEach(suffix => {
	    result.add(suffix);
	    result.add(concat_words(letter,suffix));
	});
    });
    return result;
}


function generate_automaton() {
    let states = new Set();
    let finals = new Set();
    let transitions = {};
    S.forEach (prefix => {
	let row = rows[prefix];
	states.add(row);
	if (rows[prefix][0])
	    finals.add(row);
	if (!(row in transitions)) {
	    transitions[row] = {};
	    alphabet.forEach (letter => {
		let new_prefix = concat_words(prefix, letter);
		(transitions[row])[letter] = rows[new_prefix];
	    });
	}
	
    });

    let initial = rows["ε"];

    return {
	states : states,
	initial : initial,
	finals : finals,
	transitions : transitions
    }
}

// We have to write this by hand since arrays does not seem to implement equality check
function state_in_set(state, set_of_states) {
    for (row of set_of_states) 
	if (compareRows(row, state))
	    return true;
    return false;
}

function is_word_in_automaton(word) {

    let automaton = generate_automaton();
    function aux_is_word_in_automaton_at_sate(suffix, state) {
	if (suffix == "" || suffix == "ε") {
	    let finals = automaton['finals'];
	    return state_in_set(state, finals);
	}
	
	let first_letter = suffix.charAt(0);
	let new_suffix = suffix.substring(1);

	let transitions = automaton['transitions'];
	let transition_from_state = transitions[state];
	let new_state = transition_from_state[first_letter];
	return aux_is_word_in_automaton_at_sate(new_suffix, new_state);
    }

    return aux_is_word_in_automaton_at_sate(word, automaton['initial']);
}

// The core function for asking the user wether a word is in the language
//   It returns a "promise" so that the user can respond at anytime and we
//   stop the rest of the computation until we get a response
async function ask_for_T(word) {
    const questionElement = document.getElementById('question');

    question = 'Is the word "' + word + '" inside your langage?';
    questionElement.textContent = question;

    // // Force a small delay to ensure the DOM update is rendered
    // await new Promise(resolve => setTimeout(resolve, 0));

    
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
    if (! (word in memoized_words)) {
	memoized_words[word] = await ask_for_T(word);
    }
    return memoized_words[word];
}

// Construct a graphviz representation of the graph implied by the observations
async function constructGraphAutomaton() {

    // Go through everyone once so we construct only one state per different row value
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
    // add the initial state
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

// Wether the current rows describe a consistent observation tables
//   It returns null if the table is consistent
//   ... else it returns a counter example containing all the data in a dictionnary
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

// Recompute the rows with the observation of S and S U A
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


// Goes through the L* algorithm until we can construct a guessed automaton
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
    document.querySelector(".wowo-animation").style.animation = "make_wowo 2s";
    win();
    setTimeout(() => { document.querySelector(".wowo-animation").style.animation = "" },2000);
    document.getElementById('question-section').classList.add('hidden');
    document.getElementById('automaton').classList.remove('hidden');
    renderGraph(automaton_guess);
    // Arbitrary size 3; should be modified
    let recognized_words = [];
    let words = enumerate_words(3);
    enumerate_words(3).forEach( word => {
	if (is_word_in_automaton(word))
	    recognized_words.push(word);
    });
    recognized_words.sort();
    document.getElementById('first_words').textContent = recognized_words.join(", ");

}

// Function to handle alphabet submission
document.getElementById('submitAlphabet').addEventListener('click', function() {
    const alphabetInput = document.getElementById('alphabet').value;
    let tmp_alphabet = alphabetInput.split(',').map(letter => letter.trim()).filter(Boolean); // Filter out empty strings

    if (tmp_alphabet.length == 0) {
	alert("Your alphabet is empty!");
	return;
    }

    for (const a of tmp_alphabet)
	if (a.length != 1) {
	    alert("The letter '"+a+"' is not a valid letter. Please remove it.")
	    return;
	}

    for (const a of tmp_alphabet)
	alphabet.add(a);
    
    document.getElementById('alphabet-input').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    document.getElementById('observation-table-container').classList.remove('hidden');
    L_star_algorithm();	
});

// When we propose a guess to the user, we wait for a counterexample
//   if one is provided, add the corresponding prefixes, and go back executing L*
document.getElementById('submitCounterexample').addEventListener('click', function() {

    const cexInput = document.getElementById('counterexample').value;
    const cexLength = cexInput.length;

    if (cexLength == 0) {
	alert("Please, enter a counterexample");
	return;
    }
    
    for (var i = 0; i < cexLength; i++)
	if (!(alphabet.has(cexInput.charAt(i)))) {
	    alert("The character '"+cexInput.charAt(i)+"' of your counterexample is not one in the given alphabet!");
	    return;
	}
    
    
    document.getElementById('question-section').classList.remove('hidden');
    document.getElementById('automaton').classList.add('hidden');

    for (var i = 1; i <= cexLength; i++) {
	S.add(cexInput.substring(0, i));
    }

    L_star_algorithm();
    
});

gsap.registerPlugin(MotionPathPlugin);

  // init
	var tl= new TimelineMax();
	tl.from('.gface', 0.6, {scale: -0, transformOrigin: "center", ease: Power3.easeOut})
	tl.from('.eyes', 0.6, {scale: -0, transformOrigin: "center", ease: Power3.easeOut},"-=0.3")
  
  // eyes animation
	var tl2= new TimelineMax();
	tl2.from('.inside', 0.15, {scaleY: 1, transformOrigin: "center", ease: Linear.easeOut})
	tl2.to('.inside', 0.05, {scaleY: 0, transformOrigin: "center", ease: Linear.easeOut})
	.to('.inside', 0.4, {scaleY: 1, transformOrigin: "center", ease: Power3.easeOut})

	var speak = new TimelineMax();
	speak.from('.mouth', 0.15, {scaleY: 1, scaleX : 1, transformOrigin: "center", ease: Linear.easeOut})
	.to('.mouth', 0.15, {scaleY: 1.5, scaleX : 0.8, transformOrigin: "center", ease: Linear.easeOut})
	.to('.mouth', 0.15, {scaleY: 2, transformOrigin: "center", ease: Linear.easeOut})
	.to('.mouth', 0.15, {scaleY: 1, ScaleX : 1, transformOrigin: "center", ease: Linear.easeOut})
	speak.repeat(-1)
	let a = setInterval(()=>{
		setTimeout(()=>{tl2.play(0)},Math.random()*3000)
		},3000);
  
  let success = new TimelineMax();
  
  success.from('.nose',2, {
    transformOrigin : "center",
    ease : Power3.easeOut,
    rotate : "360deg"
  }).from(".hair",1, {
        transformOrigin : "center",
        ease : Power3.easeOut,
        rotate : "360deg"
          },"-=2")
  .to(".inside", 0.5, {
        transformOrigin : "center",
        ease : Power3.easeOut,
        scale : "5",
  },"-=3").
  to(".inside", 1, {
        transformOrigin : "center",
        ease : Power3.easeOut,
        transform : "",
  },"-=2.5");
  
  let win= () => {
    clearInterval(a);
    speak.play(0);
    success.play(0);
    setTimeout(()=>{
      speak.pause();
      //tl.play(0);
      tl2.play(0);
      a = setInterval(()=>{
		setTimeout(()=>{tl2.play(0)},Math.random()*3000)
		},3000);
    },2000)
  }
  
