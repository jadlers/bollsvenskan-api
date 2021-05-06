import { Server } from "socket.io";

export default function addSocketIo(server) {
  const io = new Server(server);

  io.on("connection", (socket) => {
    console.log(`New client connected`);

    socket.on("message", (msg) => {
      // Parse message and inform sender if it's not JSON
      try {
        msg = JSON.parse(msg);
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: "ERROR",
            message: "Messages sent have to be JSON",
          })
        );
        return;
      }

      // Check if message which we're waiting for with teams
      if (msg.type === "BROADCAST_TEAMS") {
        console.log("Slowly revealing following teams: ", msg.teams);
        sendTeamsWithTension(io, msg.teams);
      } else {
        // Broadcast all other messages sent
        socket.send(JSON.stringify({ title: `Broadcasting:`, message: msg }));
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client closed connection`);
    });
  });

  return io;
}

/**
 * One player at a time will be moved from the `playersLeft` array to it's team.
 * Some timeout between each sent player.
 *
 * @param {Object} finalTeams Teams to be revealed
 */
function sendTeamsWithTension(io, finalTeams) {
  const timeout = 2000;
  // The JSON object updated and sent
  let broadcast = {
    type: "BROADCAST_TEAM_PLAYERS_ONE_BY_ONE",
    team1: {
      players: [],
      numPlayers: finalTeams.team1.players.length,
      rating: null,
    },
    team2: {
      players: [],
      numPlayers: finalTeams.team2.players.length,
      rating: null,
    },
    playersLeft: shuffle(
      Object.entries(finalTeams)
        .map(([_, team]) => team.players)
        .flat()
    ),
  };

  const intervalId = setInterval(() => {
    if (broadcast.playersLeft.length === 0) {
      clearInterval(intervalId);
      return;
    }

    const [nextPlayer, ...remaining] = broadcast.playersLeft;
    const playerTeam = finalTeams.team1.players.includes(nextPlayer)
      ? "team1"
      : "team2";
    broadcast[playerTeam].players = [
      ...broadcast[playerTeam].players,
      nextPlayer,
    ];
    broadcast.playersLeft = remaining;

    // Reveal ELO rating when last player has been assign a team
    if (remaining.length === 0) {
      broadcast.team1.rating = finalTeams.team1.rating;
      broadcast.team2.rating = finalTeams.team2.rating;
    }

    // Send to all connected socket.io clients
    io.emit("message", JSON.stringify(broadcast));
  }, timeout);
}

// Taken from here: https://bost.ocks.org/mike/shuffle/
function shuffle(array) {
  let m = array.length;

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    let i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    let t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}
