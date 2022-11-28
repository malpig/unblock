import Head from "next/head";
import { useTheme } from "next-themes";
import styles from "../styles/Home.module.css";
import React, { useEffect } from "react";
import { EmojiContext } from "../context/EmojiContext";

import fsPromises from 'fs/promises';
import path from 'path'

import Flow from "components/Flow";

import { generateGraphFromBuildSteps } from "utils/graph";

function buildEmojiLookupTable(json) {
  var emojis = {};

  json.forEach(function (emoji) {
    emojis[emoji.name] = emoji.url;

    if (emoji.aliases) {
      emoji.aliases.forEach(function (alias) {
        emojis[alias] = emoji.url;
      });
    }
  });

  return emojis;
}

function convertToLiveblocksStorage(object) {
  if (Array.isArray(object)) {
    let x = { liveblocksType: 'LiveList', data: [] }
    object.forEach((v) => {
      x.data.push(convertToLiveblocksStorage(v));
    });
    return x;
  } else if (typeof object == 'object') {
    let x = { liveblocksType: 'LiveObject', data: {} };
    for (const [key, value] of Object.entries(object)) {
      x.data[key] = convertToLiveblocksStorage(value);
    }
    return x;
  } else if (typeof object == 'string' || typeof object == 'number' || typeof object == 'boolean') {
    return object;
  } else {
    throw new Error(`cant convertToLiveblocksStorage with typeof: ${typeof(object)}`);
  }
}

function convertFromLiveblocksStorage(object) {
  if (typeof object == 'object') {
    if (object.liveblocksType == 'LiveObject') {
      let x = { };
      for (const [key, value] of Object.entries(object.data)) {
        x[key] = convertFromLiveblocksStorage(value);
      }
      return x;
    } else if (object.liveblocksType == 'LiveList') {
      return object.data.map((x) => convertFromLiveblocksStorage(x));
    } else {
      throw new Error(`cant convertFromLiveblocksStorage with liveblocksType: ${object.liveblocksType}`);
    }
  } else if (typeof object == 'string' || typeof object == 'number' || typeof object == 'boolean') {
    return object;
  } else {
    throw new Error(`cant convertFromLiveblocksStorage with typeof: ${typeof(object)}`);
  }
}

export async function getServerSideProps(context) {
  let buildSlug = context.query["build"];
  if (
    buildSlug === null ||
    buildSlug === undefined ||
    (buildSlug && buildSlug.trim() === "")
  ) {
    buildSlug = "default";
  }

  // worst validation ever
  if (buildSlug != 'default' || buildSlug != 'b1' || buildSlug != 'b2' || buildSlug != 'b3') {
    buildSlug == 'default';
  }

  let version = context.query["version"];
  if (
    version === null ||
    version === undefined ||
    (version && version.trim() === "")
  ) {
    version = "v1";
  }

  const filePath = path.join(process.cwd(), 'json', buildSlug + '.json');
  const jsonData = await fsPromises.readFile(filePath);
  const buildResponse = JSON.parse(jsonData);
  const roomId = encodeURIComponent(`${buildSlug}-${version}`);

  const getStorageResponse = await fetch(
    `https://api.liveblocks.io/v2/rooms/${roomId}/storage`,
    {
      headers: {
        Authorization: `Bearer ${process.env.LIVEBLOCKS_PRIVATE_KEY}`,
      },
    }
  );
  let liveblocksStorage = await getStorageResponse.json();

  // Room doesn't exist? Let's create it and fill it with some stuff...
  if (liveblocksStorage.error == "ROOM_NOT_FOUND") {
    // Make the room
    const roomCreateResponse = await fetch(
      `https://api.liveblocks.io/v2/rooms`,
      {
        method: "POST",
        body: JSON.stringify({ id: roomId, defaultAccesses: ["room:write"] }),
        headers: {
          Authorization: `Bearer ${process.env.LIVEBLOCKS_PRIVATE_KEY}`,
        },
      }
    );
    const roomCreateResponseJSON = await roomCreateResponse.json();

    // Come up with initial storage
    const { nodes, edges } = generateGraphFromBuildSteps(buildResponse.data.build.steps);
    const initialStorage = convertToLiveblocksStorage({ nodes: nodes, edges: edges });

    // Set initial storage
    const initialStorageSetResponse = await fetch(
      `https://api.liveblocks.io/v2/rooms/${roomId}/storage`,
      {
        method: "POST",
        body: JSON.stringify(initialStorage),
        headers: {
          Authorization: `Bearer ${process.env.LIVEBLOCKS_PRIVATE_KEY}`,
        },
      }
    );
    liveblocksStorage = await initialStorageSetResponse.json();
  };

  const { edges, nodes } = convertFromLiveblocksStorage(liveblocksStorage);

  const emoji_res = await fetch(
    `https://api.buildkite.com/v2/organizations/${process.env.BUILDKITE_ORG}/emojis?access_token=${process.env.BUILDKITE_ACCESS_TOKEN}`
  );
  const emoji_json = await emoji_res.json();
  const emoji = buildEmojiLookupTable(emoji_json);

  return { props: { roomId: roomId, build: buildResponse.data.build, edges, nodes, emoji } };
}

export default function Home({ roomId, build, edges, nodes, emoji }) {
  return (
    <div className={styles.container}>
      <Head>
        <title>🎮</title>
      </Head>
      <EmojiContext.Provider value={emoji}>
        <Flow roomId={roomId} initialNodes={nodes} initialEdges={edges} />
      </EmojiContext.Provider>
    </div>
  );
}
