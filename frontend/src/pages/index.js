// src/pages/LandingPage.jsx
import React, { useState, useEffect } from "react";
import {
  Database,
  Cloud,
  Shield,
  Code,
  Settings,
  Monitor,
  Rocket,
  Users,
  Cog,
  Network,
  TrendingUp,
  Mail,
  Server,
  Terminal,
  FileText,
  CheckCircle,
  ExternalLink,
  Github,
  Play,
  Layers
} from "lucide-react";
import { FaDatabase, FaRocket } from "react-icons/fa";
import { SiEthereum } from "react-icons/si";
import { MdMonitor } from "react-icons/md";

const techStack = [
  {
    name: "React + Vite",
    icon: <div className="text-blue-500 text-4xl font-bold">⚛️</div>,
    link: "https://react.dev/",
    description:
      "Modern frontend library with lightning-fast Vite bundling for optimal development experience.",
    category: "Frontend",
    pros: [
      "Component-based architecture",
      "Virtual DOM optimization",
      "Rich ecosystem",
      "Hot module replacement"
    ],
    useCases: [
      "Interactive UIs",
      "Real-time dashboards",
      "Progressive web apps"
    ]
  },
  {
    name: "TailwindCSS",
    icon: <div className="text-teal-400 text-4xl font-bold">🎨</div>,
    link: "https://tailwindcss.com/",
    description:
      "Utility-first CSS framework enabling rapid UI development with consistent design systems.",
    category: "Styling",
    pros: [
      "Utility-first approach",
      "Custom design systems",
      "Responsive design",
      "Small bundle size"
    ],
    useCases: ["Responsive layouts", "Component styling", "Design consistency"]
  },
  {
    name: "Node.js + Express",
    icon: <Server className="text-green-600 text-4xl" />,
    link: "https://nodejs.org/",
    description:
      "High-performance JavaScript runtime with Express framework for scalable backend services.",
    category: "Backend",
    pros: [
      "Non-blocking I/O",
      "NPM ecosystem",
      "JavaScript everywhere",
      "Microservices ready"
    ],
    useCases: [
      "REST APIs",
      "Real-time services",
      "Microservices",
      "Authentication"
    ]
  },
  {
    name: "Hardhat",
    icon: <div className="text-purple-500 text-4xl font-bold">⚡</div>,
    link: "https://hardhat.org/",
    description:
      "Professional Ethereum development environment with built-in testing, debugging, and deployment.",
    category: "Blockchain",
    pros: [
      "Local blockchain",
      "Smart contract testing",
      "Gas optimization",
      "Plugin ecosystem"
    ],
    useCases: [
      "Smart contracts",
      "DeFi protocols",
      "NFT platforms",
      "Token systems"
    ]
  },
  {
    name: "PostgreSQL",
    icon: <Database className="text-blue-700 text-4xl" />,
    link: "https://www.postgresql.org/",
    description:
      "Advanced open-source relational database with JSON support and ACID compliance.",
    category: "Database",
    pros: ["ACID compliance", "JSON support", "Advanced queries", "Extensible"],
    useCases: [
      "Transactional data",
      "Complex queries",
      "Data integrity",
      "Analytics"
    ]
  },
  {
    name: "MongoDB",
    icon: <Layers className="text-green-600 text-4xl" />,
    link: "https://www.mongodb.com/",
    description:
      "Flexible NoSQL document database perfect for rapid development and horizontal scaling.",
    category: "Database",
    pros: [
      "Schema flexibility",
      "Horizontal scaling",
      "Rich queries",
      "Aggregation pipeline"
    ],
    useCases: [
      "User profiles",
      "Content management",
      "Real-time data",
      "IoT applications"
    ]
  },
  {
    name: "Redis",
    icon: <div className="text-red-500 text-4xl font-bold">🔥</div>,
    link: "https://redis.io/",
    description:
      "In-memory data structure store for caching, session management, and message queuing.",
    category: "Cache & Queue",
    pros: [
      "Sub-millisecond latency",
      "Data structures",
      "Pub/Sub messaging",
      "Persistence options"
    ],
    useCases: [
      "Session storage",
      "Caching",
      "Rate limiting",
      "Real-time analytics"
    ]
  },
  {
    name: "MinIO",
    icon: (
      <img
        src="/assets/minio.svg"
        alt="MinIO"
        className="w-[4.5rem] h-[4.5rem] -mb-5 -mt-5"
      />
    ),
    link: "https://min.io/",
    description:
      "High-performance object storage with S3 compatibility for files, images, and backups.",
    category: "Storage",
    pros: [
      "S3 compatible",
      "Self-hosted",
      "High performance",
      "Kubernetes native"
    ],
    useCases: ["File uploads", "Image storage", "Backup systems", "Data lakes"]
  },
  {
    name: "Nodemailer + Mailpit",
    icon: <Mail className="text-yellow-600 text-4xl" />,
    link: "https://nodemailer.com/",
    description:
      "Comprehensive email solution with SMTP testing and delivery via local dev server.",
    category: "Communication",
    pros: [
      "Email testing",
      "Template support",
      "Attachment handling",
      "Dev workflow"
    ],
    useCases: [
      "User notifications",
      "Email verification",
      "Marketing emails",
      "Alerts"
    ]
  },
  {
    name: "Docker Compose",
    icon: <div className="text-blue-400 text-4xl font-bold">🐳</div>,
    link: "https://docs.docker.com/compose/",
    description:
      "Multi-container orchestration ensuring consistent development and production environments.",
    category: "DevOps",
    pros: [
      "Environment consistency",
      "Easy setup",
      "Service isolation",
      "Production parity"
    ],
    useCases: [
      "Development setup",
      "CI/CD pipelines",
      "Microservices",
      "Testing environments"
    ]
  },
  {
    name: "Jest + Supertest",
    icon: <CheckCircle className="text-pink-500 text-4xl" />,
    link: "https://jestjs.io/",
    description:
      "Comprehensive testing framework with API testing capabilities and detailed reporting.",
    category: "Testing",
    pros: [
      "Zero configuration",
      "Snapshot testing",
      "Mocking capabilities",
      "Coverage reports"
    ],
    useCases: [
      "Unit testing",
      "API testing",
      "Integration tests",
      "Continuous testing"
    ]
  },
  {
    name: "Allure Reporting",
    icon: (
      <img
        src="/assets/allure.svg"
        alt="Allure"
        className="w-[1.75rem] h-[1.75rem] -mb-5 -mt-5"
      />
    ),
    link: "https://docs.qameta.io/allure/",
    description:
      "Visual test reports with trends, test logs, and failure analysis for comprehensive testing insights.",
    category: "Testing",
    pros: [
      "Visual reports",
      "Trend analysis",
      "Detailed logs",
      "Integration ready"
    ],
    useCases: [
      "Test reporting",
      "CI/CD integration",
      "Quality metrics",
      "Failure analysis"
    ]
  },
  {
    name: "JWT + Wallet Auth",
    icon: <Shield className="text-purple-600 text-4xl" />,
    link: "https://eips.ethereum.org/EIPS/eip-4361",
    description:
      "Dual authentication system supporting traditional login and Web3 wallet signatures.",
    category: "Security",
    pros: [
      "Stateless auth",
      "Web3 integration",
      "Multi-tenant",
      "Session management"
    ],
    useCases: [
      "User authentication",
      "API security",
      "Wallet integration",
      "Access control"
    ]
  },
  {
    name: "pgAdmin / RedisInsight / Mongo Express",
    icon: <div className="text-gray-700 text-2xl font-bold">🛠️</div>,
    link: "#",
    description:
      "Admin dashboards for PostgreSQL, Redis, and MongoDB with comprehensive management tools.",
    category: "DevOps",
    pros: [
      "Visual interfaces",
      "Query builders",
      "Performance monitoring",
      "Easy management"
    ],
    useCases: [
      "Database admin",
      "Performance tuning",
      "Data exploration",
      "Development tools"
    ]
  },
  {
    name: "CI Testing via Docker",
    icon: <Terminal className="text-blue-400 text-4xl" />,
    link: "https://docs.docker.com/compose/",
    description:
      "Run isolated backend tests in CI using docker-compose.test.yml for consistent environments.",
    category: "DevOps",
    pros: [
      "Environment isolation",
      "Consistent testing",
      "CI/CD integration",
      "Parallel execution"
    ],
    useCases: [
      "Continuous integration",
      "Automated testing",
      "Quality assurance",
      "Deployment validation"
    ]
  }
];

const features = [
  {
    icon: <Rocket className="text-blue-500 text-3xl" />,
    title: "Production-Ready Architecture",
    description:
      "Full-stack application with containerized microservices, automated testing, and CI/CD pipeline integration.",
    details: [
      "Dockerized development environment",
      "Multi-database support (PostgreSQL, MongoDB, Redis)",
      "Automated testing with Jest and Supertest",
      "Production-ready deployment configuration"
    ]
  },
  {
    icon: <Shield className="text-green-500 text-3xl" />,
    title: "Advanced Security",
    description:
      "Multi-layered security with JWT authentication, Web3 wallet integration, and comprehensive session management.",
    details: [
      "JWT token-based authentication",
      "Web3 wallet signature verification",
      "Rate limiting and CORS protection",
      "Session management and security auditing"
    ]
  },
  {
    icon: <Cog className="text-purple-500 text-3xl" />,
    title: "Developer Experience",
    description:
      "Optimized development workflow with hot reloading, visual admin tools, and comprehensive API documentation.",
    details: [
      "Hot module replacement with Vite",
      "Visual database admin interfaces",
      "Email testing with Mailpit",
      "Comprehensive API endpoint documentation"
    ]
  },
  {
    icon: <Users className="text-orange-500 text-3xl" />,
    title: "Multi-Tenant Support",
    description:
      "Built-in multi-tenancy with isolated data, custom configurations, and scalable user management.",
    details: [
      "Tenant-isolated data access",
      "Custom tenant configurations",
      "Role-based access control",
      "Scalable user management system"
    ]
  },
  {
    icon: <Network className="text-teal-500 text-3xl" />,
    title: "Blockchain Integration",
    description:
      "Native Web3 support with smart contract deployment, transaction management, and NFT capabilities.",
    details: [
      "Smart contract development with Hardhat",
      "Transaction monitoring and management",
      "NFT minting and marketplace features",
      "Web3 wallet integration"
    ]
  },
  {
    icon: <TrendingUp className="text-red-500 text-3xl" />,
    title: "Monitoring & Analytics",
    description:
      "Comprehensive monitoring with health checks, performance metrics, and detailed logging systems.",
    details: [
      "Real-time health monitoring",
      "Performance metrics and analytics",
      "Structured logging with rotation",
      "Error tracking and alerting"
    ]
  }
];

const TechCard = ({ tech, isExpanded, onToggle }) => (
  <div
    className={`bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 cursor-pointer border-l-4 ${
      tech.category === "Frontend"
        ? "border-blue-500"
        : tech.category === "Backend"
        ? "border-green-500"
        : tech.category === "Database"
        ? "border-purple-500"
        : tech.category === "Blockchain"
        ? "border-yellow-500"
        : tech.category === "DevOps"
        ? "border-red-500"
        : "border-gray-500"
    }`}
    onClick={onToggle}
  >
    <div className="flex items-center space-x-4 mb-4">
      <div className="animate-pulse">{tech.icon}</div>
      <div>
        <h3 className="font-bold text-gray-900 text-lg">{tech.name}</h3>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            tech.category === "Frontend"
              ? "bg-blue-100 text-blue-800"
              : tech.category === "Backend"
              ? "bg-green-100 text-green-800"
              : tech.category === "Database"
              ? "bg-purple-100 text-purple-800"
              : tech.category === "Blockchain"
              ? "bg-yellow-100 text-yellow-800"
              : tech.category === "DevOps"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {tech.category}
        </span>
      </div>
    </div>

    <p className="text-gray-600 mb-4">{tech.description}</p>

    <div
      className={`overflow-hidden transition-all duration-500 ${
        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      }`}
    >
      <div className="border-t pt-4 mt-4">
        <h4 className="font-semibold text-gray-800 mb-2">Key Benefits:</h4>
        <ul className="list-disc list-inside text-sm text-gray-600 mb-4">
          {tech.pros?.map((pro, i) => (
            <li key={i} className="mb-1">
              {pro}
            </li>
          ))}
        </ul>

        <h4 className="font-semibold text-gray-800 mb-2">Use Cases:</h4>
        <div className="flex flex-wrap gap-2">
          {tech.useCases?.map((useCase, i) => (
            <span
              key={i}
              className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs"
            >
              {useCase}
            </span>
          ))}
        </div>
      </div>
    </div>

    <div className="flex justify-between items-center mt-4">
      <a
        href={tech.link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
        onClick={(e) => e.stopPropagation()}
      >
        Learn More <span className="ml-1">↗</span>
      </a>
      <span className="text-gray-400 text-xs">
        {isExpanded ? "Click to collapse" : "Click to expand"}
      </span>
    </div>
  </div>
);

const FeatureCard = ({ feature, index }) => (
  <div
    className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1"
    style={{ animationDelay: `${index * 0.1}s` }}
  >
    <div className="flex items-center space-x-4 mb-6">
      <div className="animate-bounce">{feature.icon}</div>
      <h3 className="text-2xl font-bold text-gray-900">{feature.title}</h3>
    </div>

    <p className="text-gray-600 mb-6 leading-relaxed">{feature.description}</p>

    <div className="space-y-3">
      {feature.details.map((detail, i) => (
        <div key={i} className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
          <span className="text-gray-700 text-sm">{detail}</span>
        </div>
      ))}
    </div>
  </div>
);

const AnimatedCounter = ({ end, duration = 2000 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    const animateCount = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      setCount(Math.floor(end * percentage));

      if (percentage < 1) {
        requestAnimationFrame(animateCount);
      }
    };

    requestAnimationFrame(animateCount);
  }, [end, duration]);

  return <span>{count}</span>;
};

export default function LandingPage({ onNavigateToAuth }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedTech, setExpandedTech] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const stats = [
    { label: "Technologies", value: 12, suffix: "+" },
    { label: "API Endpoints", value: 50, suffix: "+" },
    { label: "Test Coverage", value: 85, suffix: "%" },
    { label: "Setup Time", value: 5, suffix: " min" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 text-gray-800 flex flex-col">
      {/* Animated Header */}
      <header className="bg-white/80 backdrop-blur-lg shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div
              className={`transform transition-all duration-1000 ${
                isVisible
                  ? "translate-x-0 opacity-100"
                  : "-translate-x-full opacity-0"
              }`}
            >
              <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                Web3 DApp Starter
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Production-ready blockchain development platform
              </p>
            </div>

            <nav
              className={`flex space-x-6 transform transition-all duration-1000 delay-300 ${
                isVisible
                  ? "translate-x-0 opacity-100"
                  : "translate-x-full opacity-0"
              }`}
            >
              {[
                { id: "overview", label: "Overview" },
                { id: "tech", label: "Tech Stack" },
                { id: "features", label: "Features" },
                { id: "get-started", label: "Get Started" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                      : "text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {/* Auth Button */}
              <button
                onClick={onNavigateToAuth}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                <Shield className="inline mr-2" />
                Try Demo
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Overview Section */}
        {activeTab === "overview" && (
          <div className="space-y-20">
            {/* Hero Section */}
            <section className="py-20 text-center">
              <div className="max-w-6xl mx-auto px-6">
                <div
                  className={`transform transition-all duration-1000 ${
                    isVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-10 opacity-0"
                  }`}
                >
                  <h2 className="text-6xl font-bold text-gray-900 mb-6">
                    Build the Future of
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {" "}
                      Decentralized Apps
                    </span>
                  </h2>
                  <p className="text-xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
                    A comprehensive full-stack development platform combining
                    modern web technologies with blockchain capabilities.
                    Everything you need to build, test, and deploy
                    production-ready decentralized applications.
                  </p>
                </div>

                {/* Animated Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
                  {stats.map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg transform transition-all duration-1000 delay-${
                        index * 100
                      } ${
                        isVisible
                          ? "translate-y-0 opacity-100"
                          : "translate-y-10 opacity-0"
                      }`}
                    >
                      <div className="text-4xl font-bold text-blue-600 mb-2">
                        <AnimatedCounter end={stat.value} />
                        <span>{stat.suffix}</span>
                      </div>
                      <div className="text-gray-700 font-medium">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={onNavigateToAuth}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                  >
                    <Rocket className="inline mr-2" />
                    Try Demo Now
                  </button>
                  <button
                    onClick={() => setActiveTab("tech")}
                    className="bg-white/80 backdrop-blur-sm text-gray-700 px-8 py-4 rounded-xl font-bold text-lg border-2 border-gray-200 hover:border-blue-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300"
                  >
                    <Code className="inline mr-2" />
                    Explore Tech Stack
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Overview */}
            <section className="py-16 bg-white/50 backdrop-blur-sm">
              <div className="max-w-6xl mx-auto px-6">
                <h3 className="text-4xl font-bold text-center mb-16 text-gray-900">
                  Everything You Need in One Platform
                </h3>
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="text-center p-6">
                    <FaDatabase className="text-5xl text-blue-500 mx-auto mb-4" />
                    <h4 className="text-xl font-bold mb-3">
                      Multi-Database Support
                    </h4>
                    <p className="text-gray-600">
                      PostgreSQL for relational data, MongoDB for documents,
                      Redis for caching
                    </p>
                  </div>
                  <div className="text-center p-6">
                    <SiEthereum className="text-5xl text-purple-500 mx-auto mb-4" />
                    <h4 className="text-xl font-bold mb-3">Blockchain Ready</h4>
                    <p className="text-gray-600">
                      Smart contract development, wallet integration, and Web3
                      authentication
                    </p>
                  </div>
                  <div className="text-center p-6">
                    <MdMonitor className="text-5xl text-green-500 mx-auto mb-4" />
                    <h4 className="text-xl font-bold mb-3">Production Ready</h4>
                    <p className="text-gray-600">
                      Containerized deployment, monitoring, testing, and CI/CD
                      integration
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Enhanced Tech Stack */}
        {activeTab === "tech" && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  ⚙️ Comprehensive Tech Stack
                </h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Carefully selected technologies that work together seamlessly
                  to provide a complete development experience from frontend to
                  blockchain.
                </p>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                {[
                  "All",
                  "Frontend",
                  "Backend",
                  "Database",
                  "Blockchain",
                  "DevOps"
                ].map((category) => (
                  <button
                    key={category}
                    className="px-6 py-2 rounded-full bg-white shadow-md hover:shadow-lg transition-all duration-300 text-gray-700 hover:text-blue-600 border hover:border-blue-300"
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {techStack.map((tech, index) => (
                  <TechCard
                    key={tech.name}
                    tech={tech}
                    isExpanded={expandedTech === index}
                    onToggle={() =>
                      setExpandedTech(expandedTech === index ? null : index)
                    }
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Enhanced Features */}
        {activeTab === "features" && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  🚀 Powerful Features
                </h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Enterprise-grade features designed for modern web3
                  applications, from development to production deployment.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {features.map((feature, index) => (
                  <FeatureCard
                    key={feature.title}
                    feature={feature}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Enhanced Get Started */}
        {activeTab === "get-started" && (
          <section className="py-16">
            <div className="max-w-6xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  🚀 Quick Setup Guide
                </h2>
                <p className="text-xl text-gray-600">
                  Get your development environment running in less than 5
                  minutes
                </p>
              </div>

              {/* Setup Steps */}
              <div className="grid md:grid-cols-3 gap-8 mb-12">
                <div className="text-center p-6 bg-white rounded-2xl shadow-lg">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-blue-600">1</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Clone Repository</h3>
                  <p className="text-gray-600">
                    Download the complete starter template
                  </p>
                </div>

                <div className="text-center p-6 bg-white rounded-2xl shadow-lg">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-purple-600">
                      2
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Start Services</h3>
                  <p className="text-gray-600">
                    One command to launch all containers
                  </p>
                </div>

                <div className="text-center p-6 bg-white rounded-2xl shadow-lg">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-green-600">3</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">Start Building</h3>
                  <p className="text-gray-600">
                    Begin developing your DApp immediately
                  </p>
                </div>
              </div>

              {/* Command Line */}
              <div className="bg-gray-900 rounded-2xl p-8 mb-12 shadow-2xl">
                <div className="flex items-center mb-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-gray-400 ml-4 text-sm">Terminal</span>
                </div>
                <pre className="text-green-400 text-sm font-mono overflow-x-auto">
                  {`# Clone the repository
$ git clone https://github.com/adamoates/web3-dapp-starter.git
$ cd web3-dapp-starter

# Start the development environment
$ docker-compose up --build

# 🎉 Your development environment is ready!`}
                </pre>
              </div>

              {/* Service URLs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    name: "Frontend",
                    url: "http://localhost:3000",
                    color: "blue"
                  },
                  {
                    name: "Backend API",
                    url: "http://localhost:5001",
                    color: "green"
                  },
                  {
                    name: "Database Admin",
                    url: "http://localhost:8080",
                    color: "purple"
                  },
                  {
                    name: "Email Testing",
                    url: "http://localhost:8025",
                    color: "yellow"
                  }
                ].map((service) => (
                  <div
                    key={service.name}
                    className={`bg-${service.color}-50 border-l-4 border-${service.color}-400 p-4 rounded-lg`}
                  >
                    <h4 className={`font-bold text-${service.color}-800`}>
                      {service.name}
                    </h4>
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-${service.color}-600 text-sm hover:underline`}
                    >
                      {service.url} ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Enhanced Footer */}
      <footer className="bg-gradient-to-r from-gray-900 to-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Web3 DApp Starter
              </h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Accelerate your Web3 development with our comprehensive starter
                template. Built for developers who want to focus on building
                amazing decentralized applications without worrying about
                infrastructure setup.
              </p>
              <div className="flex space-x-4">
                <a
                  href="#"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <Github className="text-2xl" />
                </a>
                <a
                  href="#"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <Code className="text-2xl" />
                </a>
                <a
                  href="#"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <ExternalLink className="text-2xl" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API Reference
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Examples
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Community
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Getting Started
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Best Practices
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Deployment Guide
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} Web3 DApp Starter. Open source and
              ready for innovation.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <span className="text-gray-400 text-sm">
                Built with ❤️ for the Web3 community
              </span>
              <div className="flex space-x-2">
                <div className="text-blue-400 text-lg">⚛️</div>
                <div className="text-purple-400 text-lg">⚡</div>
                <div className="text-blue-300 text-lg">🐳</div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={onNavigateToAuth}
          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl transform hover:scale-110 transition-all duration-300 group"
        >
          <FaRocket className="text-xl group-hover:animate-pulse" />
        </button>
      </div>
    </div>
  );
}
