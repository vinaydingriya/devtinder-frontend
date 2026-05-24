import api from "../utils/api";


import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { addConnections, removeConnection } from '../utils/connectionsSlice';

const Connections = () => {
  const dispatch = useDispatch();
  const connections = useSelector(store => store.connections);

  const handleRemoveConnection = async (connectionId, name) => {
    if (!window.confirm(`Are you sure you want to remove connection with ${name}? This will also delete all chat history.`)) {
      return;
    }
    try {
      await api.delete(`/connection/remove/${connectionId}`);
      dispatch(removeConnection(connectionId));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to remove connection");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchConnections() {
      if (connections.length > 0) return;

      try {
        const res = await api.get("/user/connections", {
          signal,
        });
        dispatch(addConnections(res.data.data));
      } catch (e) {
        if (e.code !== "ERR_CANCELED" && e.code !== "ECONNABORTED") {
          console.log(e);
        }
      }
    }

    fetchConnections();

    return () => {
      controller.abort();
    };
  }, [dispatch, connections.length]);

  if (connections.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
        <div className="text-6xl mb-4 animate-float">🤝</div>
        <h1 className="text-2xl font-bold gradient-text mb-2">No Connections Yet</h1>
        <p className="text-slate-400 text-sm">Start swiping to find your dev match!</p>
      </div>
    );

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4 animate-fade-in-up">
      <h2 className="text-3xl font-bold text-center gradient-text mb-8">
        Your Connections
      </h2>
      <div className="space-y-4">
        {connections.map((connection, index) => (
          <div
            key={connection._id}
            className="glass-card rounded-2xl p-4 flex items-center gap-4 gradient-border hover:scale-[1.01] transition-all duration-300 opacity-0 animate-fade-in-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <Link to={`/user/${connection._id}`} className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-purple-500/30 flex-shrink-0">
                <img
                  src={connection.photoUrl}
                  alt={connection.firstName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-lg truncate hover:text-purple-300 transition-colors flex items-center">
                  {connection.firstName +
                    (connection.lastName ? " " + connection.lastName : "")}
                  {connection.isPremium && (
                    <svg className="inline-block w-4 h-4 ml-1 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" title="Verified Premium">
                      <path d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" />
                    </svg>
                  )}
                </h3>
                {connection.about && (
                  <p className="text-slate-400 text-sm truncate mt-0.5">
                    {connection.about}
                  </p>
                )}
              </div>
            </Link>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                to={`/chat?userId=${connection._id}`}
                className="text-2xl hover:scale-110 transition-transform cursor-pointer"
                title="Chat"
              >
                💬
              </Link>
              <button
                onClick={() => handleRemoveConnection(connection._id, `${connection.firstName} ${connection.lastName || ""}`)}
                className="p-1.5 rounded-xl text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
                title="Remove Connection"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Connections