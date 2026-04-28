const svg = document.getElementById("graphSvg");
const addNodeBtn = document.getElementById("addNodeBtn");
const connectNodeBtn = document.getElementById("connectNodeBtn");
const clearBtn = document.getElementById("clearBtn");
const edgeTypeSelect = document.getElementById("edgeType");
const algorithmSelect = document.getElementById("algorithmSelect");
const startNodeSelect = document.getElementById("startNodeSelect");
const runBtn = document.getElementById("runBtn");
const resetTraversalBtn = document.getElementById("resetTraversalBtn");
const statusText = document.getElementById("statusText");
const orderText = document.getElementById("orderText");
const dsText = document.getElementById("dsText");

const NODE_RADIUS = 20;
const STEP_DELAY_MS = 900;

let nodes = [];
let edges = [];
let nodeCounter = 1;
let mode = "add";
let selectedForConnection = null;
let animationInProgress = false;

function setMode(nextMode) {
  mode = nextMode;
  addNodeBtn.classList.toggle("active", mode === "add");
  connectNodeBtn.classList.toggle("active", mode === "connect");
  if (mode === "add") {
    clearSelectedConnection();
    setStatus("Click inside graph area to create nodes.");
  } else {
    setStatus("Select source node, then destination node.");
  }
}

function setStatus(message) {
  if (statusText) {
    statusText.textContent = message;
  }
}

function setDataStructureText(text) {
  if (dsText) {
    dsText.textContent = text;
  }
}

function clearSelectedConnection() {
  selectedForConnection = null;
  nodes.forEach((node) => {
    if (node.state === "selected") {
      node.state = "default";
    }
  });
  draw();
}

function getSvgPoint(event) {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const x = ((event.clientX - rect.left) / rect.width) * viewBox.width;
  const y = ((event.clientY - rect.top) / rect.height) * viewBox.height;
  return { x, y };
}

function nodeAt(point) {
  return nodes.find((node) => {
    const dx = node.x - point.x;
    const dy = node.y - point.y;
    return Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS + 2;
  });
}

function edgeExists(fromId, toId, type) {
  if (type === "directed") {
    return edges.some((edge) => edge.from === fromId && edge.to === toId);
  }
  return edges.some(
    (edge) =>
      (edge.from === fromId && edge.to === toId) ||
      (edge.from === toId && edge.to === fromId)
  );
}

function addNode(point) {
  const node = {
    id: nodeCounter,
    label: `N${nodeCounter}`,
    x: point.x,
    y: point.y,
    state: "default",
  };
  nodeCounter += 1;
  nodes.push(node);
  updateStartNodeOptions();
  draw();
  setStatus(`Added node ${node.label}.`);
}

function connectNodes(firstNode, secondNode) {
  const edgeType = edgeTypeSelect.value;
  if (firstNode.id === secondNode.id) {
    setStatus("Cannot connect a node to itself.");
    return;
  }
  if (edgeExists(firstNode.id, secondNode.id, edgeType)) {
    setStatus("Edge already exists for selected direction/type.");
    return;
  }

  edges.push({
    from: firstNode.id,
    to: secondNode.id,
    type: edgeType,
  });
  draw();
  const arrowText = edgeType === "directed" ? " (directed)" : " (undirected)";
  setStatus(`Connected ${firstNode.label} -> ${secondNode.label}${arrowText}.`);
}

function updateStartNodeOptions() {
  const currentValue = startNodeSelect.value;
  startNodeSelect.innerHTML = "";
  nodes.forEach((node) => {
    const option = document.createElement("option");
    option.value = String(node.id);
    option.textContent = `${node.label}`;
    startNodeSelect.appendChild(option);
  });

  if (nodes.length > 0) {
    startNodeSelect.value = currentValue || String(nodes[0].id);
  }
}

function buildAdjacency() {
  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, []));

  edges.forEach((edge) => {
    adjacency.get(edge.from).push(edge.to);
    if (edge.type === "undirected") {
      adjacency.get(edge.to).push(edge.from);
    }
  });

  return adjacency;
}

function bfsSteps(startId, adjacency) {
  const visited = new Set([startId]);
  const queue = [startId];
  const steps = [];

  steps.push({
    current: startId,
    visited: new Set(visited),
    structure: [...queue],
  });

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = adjacency.get(current) || [];

    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
        steps.push({
          current: neighbor,
          visited: new Set(visited),
          structure: [...queue],
        });
      }
    });
  }

  return steps;
}

function dfsSteps(startId, adjacency) {
  const visited = new Set();
  const stack = [startId];
  const steps = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    for (let i = neighbors.length - 1; i >= 0; i -= 1) {
      const neighbor = neighbors[i];
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }

    steps.push({
      current,
      visited: new Set(visited),
      structure: [...stack],
    });
  }

  return steps;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getNodeById(id) {
  return nodes.find((node) => node.id === id);
}

function resetTraversalStates() {
  nodes.forEach((node) => {
    node.state = "default";
  });
  orderText.textContent = "-";
  setDataStructureText("-");
  draw();
}

async function runTraversal() {
  if (animationInProgress) {
    setStatus("Wait for current visualization to finish.");
    return;
  }
  if (nodes.length === 0) {
    setStatus("Add nodes first.");
    return;
  }
  if (!startNodeSelect.value) {
    setStatus("Pick a start node.");
    return;
  }

  animationInProgress = true;
  clearSelectedConnection();
  resetTraversalStates();

  const startId = Number(startNodeSelect.value);
  const algorithm = algorithmSelect.value;
  const adjacency = buildAdjacency();
  const steps = algorithm === "bfs" ? bfsSteps(startId, adjacency) : dfsSteps(startId, adjacency);

  if (steps.length === 0) {
    setStatus("No traversal steps found.");
    animationInProgress = false;
    return;
  }

  const order = [];
  setStatus(`Running ${algorithm.toUpperCase()}...`);
  for (const step of steps) {
    nodes.forEach((node) => {
      if (step.visited.has(node.id)) {
        node.state = "visited";
      } else {
        node.state = "default";
      }
    });

    const currentNode = getNodeById(step.current);
    if (currentNode) {
      currentNode.state = "active";
      order.push(currentNode.label);
    }

    orderText.textContent = order.join(" -> ");
    if (algorithm === "bfs") {
      setDataStructureText(`Queue: [${step.structure.map((id) => `N${id}`).join(", ")}]`);
    } else {
      setDataStructureText(`Stack: [${step.structure.map((id) => `N${id}`).join(", ")}]`);
    }
    draw();
    await sleep(STEP_DELAY_MS);
  }

  nodes.forEach((node) => {
    if (node.state === "active") {
      node.state = "visited";
    }
  });
  draw();
  setStatus(`${algorithm.toUpperCase()} complete.`);
  animationInProgress = false;
}

function clearGraph() {
  if (animationInProgress) {
    setStatus("Cannot clear while visualization is running.");
    return;
  }
  nodes = [];
  edges = [];
  nodeCounter = 1;
  selectedForConnection = null;
  startNodeSelect.innerHTML = "";
  orderText.textContent = "-";
  setDataStructureText("-");
  setStatus("Graph cleared.");
  draw();
}

function handleSvgClick(event) {
  if (animationInProgress) {
    return;
  }
  const point = getSvgPoint(event);

  if (mode === "add") {
    const existing = nodeAt(point);
    if (existing) {
      setStatus("This space already has a node. Click empty area.");
      return;
    }
    addNode(point);
    return;
  }

  if (mode === "connect") {
    const clickedNode = nodeAt(point);
    if (!clickedNode) {
      setStatus("Click on a node to connect.");
      return;
    }

    if (!selectedForConnection) {
      selectedForConnection = clickedNode.id;
      clickedNode.state = "selected";
      draw();
      setStatus(`Selected ${clickedNode.label}. Now pick destination node.`);
      return;
    }

    const firstNode = getNodeById(selectedForConnection);
    const secondNode = clickedNode;
    if (firstNode) {
      connectNodes(firstNode, secondNode);
    }
    clearSelectedConnection();
  }
}

function drawEdges(layer) {
  edges.forEach((edge) => {
    const fromNode = getNodeById(edge.from);
    const toNode = getNodeById(edge.to);
    if (!fromNode || !toNode) {
      return;
    }

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / length;
    const uy = dy / length;

    const startX = fromNode.x + ux * NODE_RADIUS;
    const startY = fromNode.y + uy * NODE_RADIUS;
    const endX = toNode.x - ux * NODE_RADIUS;
    const endY = toNode.y - uy * NODE_RADIUS;

    if (edge.type === "directed") {
      const offset = 2.5;
      const px = -uy;
      const py = ux;
      const axisReach = Math.sqrt(Math.max(1, NODE_RADIUS * NODE_RADIUS - offset * offset));
      const dirStartX = fromNode.x + ux * axisReach;
      const dirStartY = fromNode.y + uy * axisReach;
      const dirEndX = toNode.x - ux * axisReach;
      const dirEndY = toNode.y - uy * axisReach;

      const lineA = document.createElementNS("http://www.w3.org/2000/svg", "line");
      lineA.setAttribute("x1", String(dirStartX + px * offset));
      lineA.setAttribute("y1", String(dirStartY + py * offset));
      lineA.setAttribute("x2", String(dirEndX + px * offset));
      lineA.setAttribute("y2", String(dirEndY + py * offset));
      lineA.setAttribute("class", "edge directed-double");
      layer.appendChild(lineA);

      const lineB = document.createElementNS("http://www.w3.org/2000/svg", "line");
      lineB.setAttribute("x1", String(dirStartX - px * offset));
      lineB.setAttribute("y1", String(dirStartY - py * offset));
      lineB.setAttribute("x2", String(dirEndX - px * offset));
      lineB.setAttribute("y2", String(dirEndY - py * offset));
      lineB.setAttribute("class", "edge directed-double");
      layer.appendChild(lineB);
    } else {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(startX));
      line.setAttribute("y1", String(startY));
      line.setAttribute("x2", String(endX));
      line.setAttribute("y2", String(endY));
      line.setAttribute("class", "edge");
      layer.appendChild(line);
    }
  });
}

function drawNodes(layer) {
  nodes.forEach((node) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(node.x));
    circle.setAttribute("cy", String(node.y));
    circle.setAttribute("r", String(NODE_RADIUS));
    circle.setAttribute("class", `node ${node.state || "default"}`);
    layer.appendChild(circle);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(node.x));
    text.setAttribute("y", String(node.y));
    text.setAttribute("class", "node-text");
    text.textContent = node.label;
    layer.appendChild(text);
  });
}

function draw() {
  const defs = svg.querySelector("defs");
  svg.innerHTML = "";
  if (defs) {
    svg.appendChild(defs);
  }

  const edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const nodeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  drawEdges(edgeLayer);
  drawNodes(nodeLayer);
  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);
}

addNodeBtn.addEventListener("click", () => setMode("add"));
connectNodeBtn.addEventListener("click", () => setMode("connect"));
svg.addEventListener("click", handleSvgClick);
runBtn.addEventListener("click", runTraversal);
clearBtn.addEventListener("click", clearGraph);
resetTraversalBtn.addEventListener("click", () => {
  if (animationInProgress) {
    setStatus("Wait for visualization to complete.");
    return;
  }
  resetTraversalStates();
  setStatus("Traversal colors reset.");
});

setMode("add");
draw();
