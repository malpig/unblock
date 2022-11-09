export function magicallyPositionNodes(nodes, edges) {
  const dependencyHash = {}

  nodes.forEach((node) => {
    if (node.parentNode) { return; }
    dependencyHash[node.id] = [];
  });

  edges.forEach((edge) => {
    if (dependencyHash[edge.target]) {
      // If the source of this dependency is inside a group, let's redirect the
      // dependency to the group itself
      const sourceNode = nodes.find((n) => n.id == edge.source);
      if (sourceNode.parentNode) {
        dependencyHash[edge.target].push(sourceNode.parentNode);
      } else {
        dependencyHash[edge.target].push(edge.source);
      }
    }
  });

  const columns = [];

  while (true) {
    // No more dependencies to walk through, we're all done!
    if (Object.keys(dependencyHash).length == 0) {
      break;
    }

    // for (const [ nodeId, sourceIds ] of Object.entries(dependencyHash)) {
    //   console.log(`${nodes.find((n) => n.id == nodeId).data.label}`);
    //   sourceIds.forEach((v) => console.log(`\t${nodes.find((n) => n.id == v).data.label}`));
    // }

    const thisColumn = []

    // Find the next node that doesn't have any incomming dependencies and move
    // it to the current column
    for (const [ nodeId, sourceIds ] of Object.entries(dependencyHash)) {
      if (sourceIds.length == 0) {
        thisColumn.push(nodeId);
        delete dependencyHash[nodeId];
      }
    }

    // Go through all the dependencies again and remove all the references to
    // the nodes we just added to the current column. This will start to leave
    // a bunch of nodes with no more incoming dependencies that'll get removed
    // in the next iteration of that loop.
    for (const [ nodeId, sourceIds ] of Object.entries(dependencyHash)) {
      dependencyHash[nodeId] = sourceIds.filter((v) => thisColumn.indexOf(v) == -1);
    }

    columns.push(thisColumn);
  }

  const cursor = { x: 20, y: 20 };

  columns.forEach((thisColumn) => {
    // Reset the drawing cursor back to the start
    cursor.y = 20;
    let maxWidthForColumn = 0;

    thisColumn.forEach((nodeId) => {
      const node = nodes.find((n) => n.id == nodeId);

      if (node.type == "groupStep") {
        cursor.y += 40;
      }

      node.position = { ...cursor };

      if (node.style.width > maxWidthForColumn) {
        maxWidthForColumn = node.style.width;
      }

      cursor.y = cursor.y + node.style.height + 20;
    });

    cursor.x = cursor.x + maxWidthForColumn + 60;
  });

  const nodesByParentNode = {};

  nodes.forEach((node) => {
    if (node.parentNode) {
      if (!nodesByParentNode[node.parentNode]) {
        nodesByParentNode[node.parentNode] = [];
      }

      node.position = { x: 20, y: 20 + (nodesByParentNode[node.parentNode].length * 60) };

      nodesByParentNode[node.parentNode].push(node)
    }
  });

  return nodes;
};