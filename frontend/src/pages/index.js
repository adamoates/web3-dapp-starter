// src/pages/LandingPage.jsx
import React, { useState } from "react";
import {
  SiReact,
  SiTailwindcss,
  SiDocker,
  SiPostgresql,
  SiMongodb,
  SiRedis,
  SiEthereum
} from "react-icons/si";
import { MdEmail } from "react-icons/md";

const techStack = [
  {
    name: "React + Vite",
    icon: <SiReact className="text-blue-500 text-3xl" />,
    link: "https://react.dev/",
    description: "Frontend library for building UI. Vite for faster builds."
  },
  {
    name: "TailwindCSS",
    icon: <SiTailwindcss className="text-teal-400 text-3xl" />,
    link: "https://tailwindcss.com/",
    description: "Utility-first CSS for rapid UI development."
  },
  {
    name: "Hardhat",
    icon: <SiEthereum className="text-purple-500 text-3xl" />,
    link: "https://hardhat.org/",
    description: "Ethereum development environment and task runner."
  },
  {
    name: "PostgreSQL",
    icon: <SiPostgresql className="text-blue-700 text-3xl" />,
    link: "https://www.postgresql.org/",
    description: "Advanced open-source relational database."
  },
  {
    name: "MongoDB",
    icon: <SiMongodb className="text-green-600 text-3xl" />,
    link: "https://www.mongodb.com/",
    description: "NoSQL document database for flexible storage."
  },
  {
    name: "Redis",
    icon: <SiRedis className="text-red-500 text-3xl" />,
    link: "https://redis.io/",
    description: "In-memory data structure store, used for queues/caching."
  },
  {
    name: "Nodemailer + Mailpit",
    icon: <MdEmail className="text-yellow-600 text-3xl" />,
    link: "https://nodemailer.com/about/",
    description: "Email testing and delivery via dev SMTP server."
  },
  {
    name: "Docker Compose",
    icon: <SiDocker className="text-blue-400 text-3xl" />,
    link: "https://docs.docker.com/compose/",
    description: "Multi-container orchestration for dev environments."
  }
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState("tech");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-between">
          <h1 className="text-4xl font-extrabold text-gray-900">
            Web3 DApp Starter
          </h1>
          <nav className="space-x-4">
            <button
              onClick={() => setActiveTab("tech")}
              className={`text-gray-700 hover:text-blue-600 ${
                activeTab === "tech" ? "font-bold underline" : ""
              }`}
            >
              Tech Stack
            </button>
            <button
              onClick={() => setActiveTab("features")}
              className={`text-gray-700 hover:text-blue-600 ${
                activeTab === "features" ? "font-bold underline" : ""
              }`}
            >
              Features
            </button>
            <button
              onClick={() => setActiveTab("get-started")}
              className={`text-gray-700 hover:text-blue-600 ${
                activeTab === "get-started" ? "font-bold underline" : ""
              }`}
            >
              Get Started
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        {activeTab === "tech" && (
          <section className="py-16 bg-white">
            <div className="max-w-5xl mx-auto px-6 text-center">
              <h2 className="text-3xl font-semibold text-gray-900 mb-6">
                ⚙️ Tech Stack
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {techStack.map((tech) => (
                  <a
                    key={tech.name}
                    href={tech.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gray-100 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow block text-left"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      {tech.icon}
                      <span className="font-medium text-gray-900">
                        {tech.name} <span className="text-sm">↗</span>
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{tech.description}</p>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "features" && (
          <section className="py-16 bg-gray-50">
            <div className="max-w-5xl mx-auto px-6">
              <h2 className="text-3xl font-semibold text-gray-900 mb-8 text-center">
                📦 Features
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                {[
                  "Fully containerized with live reload (Docker)",
                  "Integrated email testing with Mailpit",
                  "Visual admin tools: RedisInsight, pgAdmin, Mongo Express",
                  "Smart contract support with Hardhat",
                  "REST API for blockchain & data services"
                ].map((feature, i) => (
                  <div key={i} className="flex items-start space-x-4">
                    <span className="text-2xl">✅</span>
                    <p className="text-lg text-gray-700">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "get-started" && (
          <section className="py-16 bg-white">
            <div className="max-w-5xl mx-auto px-6">
              <h2 className="text-3xl font-semibold text-gray-900 mb-6">
                🚀 Get Started
              </h2>
              <pre className="bg-gray-800 text-gray-100 text-sm p-6 rounded-lg overflow-auto">
                {`# Clone the repo
$ git clone https://github.com/YOUR_USERNAME/YOUR_REPO

# Start development stack
$ docker-compose up --build

# Access services:
Frontend: http://localhost:3000
Backend: http://localhost:5001
pgAdmin: http://localhost:8080
RedisInsight: http://localhost:8001
Mongo Express: http://localhost:8081
Mailpit: http://localhost:8025
Hoppscotch: http://localhost:3002`}
              </pre>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-400">
          © {new Date().getFullYear()} Web3 DApp Starter. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
