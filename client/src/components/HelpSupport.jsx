import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE, useMe } from "../Services/useMe";
import ActionButton, { ActionGlyph } from "./ActionButton";
import MessageBox from "./MessageBox";
import "../styles/NavbarComponents-styles/HelpSupport.css";

const SUPPORT_EMAIL = "wastezeroofficial@gmail.com";
const FEEDBACK_QUERY_KEY = ["support-feedback"];

const HELP_TOPICS = [
  {
    id: "opportunity",
    icon: "users",
    question: "How do opportunities work?",
    summary: "Understand how NGOs post events, how volunteers apply, and how updates reach both sides.",
    steps: [
      {
        icon: "plus",
        title: "NGOs create opportunities",
        description:
          "An NGO can publish community activities such as planting 1,000 trees in a day. Each listing includes the goal, date, duration, location, and any required skills.",
      },
      {
        icon: "location",
        title: "Nearby opportunities appear first",
        description:
          "When a volunteer saves their location in the profile, the dashboard can prioritize opportunities closer to them. Volunteers can then open the full details and decide whether to apply.",
      },
      {
        icon: "apply",
        title: "Volunteers apply from the details page",
        description:
          "After reviewing the event information, a volunteer can submit an application directly from the opportunity details view.",
      },
      {
        icon: "mail",
        title: "The NGO accepts or rejects applications",
        description:
          "The NGO reviews every application and responds with an acceptance or rejection. Volunteers receive real-time notifications so they always know the latest status.",
      },
      {
        icon: "contact",
        title: "Accepted volunteers coordinate and attend",
        description:
          "Once an application is accepted, the volunteer can contact the NGO through messaging for final instructions. On the event day, volunteers attend at the time and place described in the opportunity.",
      },
    ],
  },
  {
    id: "pickup",
    icon: "pickup",
    question: "How do scheduling and pickup work?",
    summary: "See the complete pickup lifecycle from volunteer request to NGO collection and recycling.",
    steps: [
      {
        icon: "pickup",
        title: "A volunteer schedules the pickup",
        description:
          "The volunteer selects the waste type, chooses a date and time, and enters the pickup location and contact details for collection.",
      },
      {
        icon: "dashboard",
        title: "NGOs review open pickup requests",
        description:
          "NGOs can see the pickup requests created by volunteers and claim the ones they want to handle.",
      },
      {
        icon: "users",
        title: "The NGO assigns an agent",
        description:
          "When an NGO claims a pickup, it assigns an agent to the request and can generate a receipt so the collection details are clear.",
      },
      {
        icon: "map",
        title: "The agent travels on the scheduled day",
        description:
          "On the pickup date, the assigned agent goes to the volunteer's location, collects the waste, and confirms the handoff.",
      },
      {
        icon: "check",
        title: "The waste is processed for recycling",
        description:
          "After collection, the NGO handles the recyclable material and the platform updates the pickup history and environmental impact.",
      },
    ],
  },
  {
    id: "contact",
    icon: "contact",
    question: "How can I contact an NGO or coordinate with other volunteers?",
    summary: "Know when direct messaging becomes available and how event coordination usually happens.",
    steps: [
      {
        icon: "apply",
        title: "Apply first",
        description:
          "The volunteer must first apply to an opportunity. Contact options are not shown before the NGO reviews that application.",
      },
      {
        icon: "check",
        title: "Wait for approval",
        description:
          "After the NGO accepts the application, the opportunity details page shows the Contact NGO action.",
      },
      {
        icon: "mail",
        title: "Message the NGO directly",
        description:
          "The Contact NGO button opens the messaging flow so the volunteer and NGO can discuss timing, expectations, and event instructions.",
      },
      {
        icon: "users",
        title: "Volunteer coordination happens through the event flow",
        description:
          "WasteZero currently centers direct coordination around NGO-to-volunteer messaging. Other volunteers are usually coordinated by the NGO through shared event instructions and on-site participation.",
      },
    ],
  },
  {
    id: "co2",
    icon: "chart",
    question: "How is CO2 saved through recycling?",
    summary: "A clearer explanation of why recycling usually creates fewer emissions than making products from raw materials.",
    steps: [
      {
        icon: "report",
        title: "Manufacturing new products releases carbon",
        description:
          "Producing a brand-new item usually requires extracting raw materials, transporting them, and processing them in factories. Each of those steps consumes energy and releases carbon dioxide.",
      },
      {
        icon: "pickup",
        title: "Recycling avoids part of that production cycle",
        description:
          "When waste is recycled instead of being thrown away, many materials can be reprocessed with less energy than creating the same product from raw resources.",
      },
      {
        icon: "chart",
        title: "Less waste outside and lower replacement demand",
        description:
          "Recycling reduces the amount of waste that needs disposal and also lowers the demand for newly manufactured materials. That combination helps reduce total carbon emissions over time.",
      },
      {
        icon: "check",
        title: "WasteZero records the positive impact",
        description:
          "When a recyclable pickup is completed, WasteZero estimates the CO2 savings for that waste category and adds the result to the user's impact data.",
      },
    ],
  },
  {
    id: "waste-types",
    icon: "dashboard",
    question: "What does each waste type mean?",
    summary: "A practical overview of the waste categories used while scheduling pickups.",
    steps: [
      {
        icon: "pickup",
        title: "Plastic",
        description:
          "Examples include bottles, containers, packaging, and household plastic items. Recycling plastic can reduce landfill waste and lower the need for new plastic production.",
      },
      {
        icon: "report",
        title: "Paper",
        description:
          "This includes newspapers, notebooks, cardboard, cartons, and office paper. Recycling paper helps reduce tree harvesting and cuts energy use in paper manufacturing.",
      },
      {
        icon: "check",
        title: "Glass",
        description:
          "Glass bottles, jars, and clean broken glass belong here. Glass can often be recycled repeatedly without losing much material quality.",
      },
      {
        icon: "users",
        title: "Metal",
        description:
          "Common examples are cans, tins, foil, and scrap metal items. Recycling metal usually saves a large amount of energy compared with producing new metal from mined ore.",
      },
      {
        icon: "leaf",
        title: "Organic Waste",
        description:
          "Food scraps, garden waste, and biodegradable material belong in this category. Proper processing can reduce methane-producing waste buildup and support composting or recovery methods.",
      },
      {
        icon: "dashboard",
        title: "Electronic Waste",
        description:
          "This includes old chargers, wires, batteries, keyboards, small devices, and other electronics. E-waste needs careful recycling because it may contain valuable metals and harmful components.",
      },
    ],
  },
];

const TopicIcon = ({ icon }) => {
  if (icon === "leaf") {
    return (
      <svg
        className="help-topic-icon-svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 20c6.5 0 12-5.5 12-12V4h-4C7.5 4 2 9.5 2 16v4h4Z" />
        <path d="M8 16c2.5-3.5 5.4-6 10-8" />
      </svg>
    );
  }

  return <ActionGlyph icon={icon} className="help-topic-icon-svg" />;
};

const FeedbackDate = ({ value }) => {
  const formatted = useMemo(() => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [value]);

  return <span>{formatted || "Recently"}</span>;
};

const HelpSupport = () => {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [openTopicId, setOpenTopicId] = useState(HELP_TOPICS[0].id);
  const [stepIndexMap, setStepIndexMap] = useState(() =>
    HELP_TOPICS.reduce((accumulator, topic) => ({ ...accumulator, [topic.id]: 0 }), {})
  );
  const [feedback, setFeedback] = useState("");
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    type: "info",
    closing: false,
  });

  const isAdmin = me?.role === "admin";

  const { data: feedbackEntries = [], isLoading: feedbackLoading } = useQuery({
    queryKey: FEEDBACK_QUERY_KEY,
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/feedback`, {
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load feedback");
      }

      return response.json();
    },
  });

  const showMessage = (message, type = "info", duration = 3200) => {
    setNotification({ open: true, message, type, closing: false });
    window.setTimeout(() => {
      setNotification((current) => ({ ...current, closing: true }));
      window.setTimeout(() => {
        setNotification({ open: false, message: "", type: "info", closing: false });
      }, 300);
    }, duration);
  };

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackValue) => {
      const response = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedbackValue }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Failed to submit feedback");
      }

      return payload;
    },
    onSuccess: () => {
      setFeedback("");
      queryClient.invalidateQueries({ queryKey: FEEDBACK_QUERY_KEY }).catch(() => {});
      showMessage("Thanks for sharing your feedback.", "success");
    },
    onError: (error) => {
      showMessage(error?.message || "Failed to submit feedback.", "error");
    },
  });

  const handleToggleTopic = (topicId) => {
    setOpenTopicId((current) => (current === topicId ? "" : topicId));
  };

  const updateStepIndex = (topicId, nextIndex) => {
    setStepIndexMap((current) => ({
      ...current,
      [topicId]: nextIndex,
    }));
  };

  const handleStepChange = (topicId, delta) => {
    const topic = HELP_TOPICS.find((entry) => entry.id === topicId);
    if (!topic) return;

    const currentIndex = stepIndexMap[topicId] || 0;
    const nextIndex = Math.min(topic.steps.length - 1, Math.max(0, currentIndex + delta));
    updateStepIndex(topicId, nextIndex);
  };

  const handleFeedbackSubmit = () => {
    const trimmedFeedback = String(feedback || "").trim();
    if (!trimmedFeedback) {
      showMessage("Please enter feedback before submitting.", "error");
      return;
    }

    submitFeedbackMutation.mutate(trimmedFeedback);
  };

  return (
    <div className="page help-support-page">
      <section className="help-hero">
        <div className="help-hero-copy">
          <div className="help-hero-badge">
            <img src="/recycle_icon.svg" alt="" className="help-hero-badge-icon" />
            <span>Help & Support</span>
          </div>
          <h1 className="help-hero-title">Support that explains every step clearly</h1>
          <p className="help-hero-text">
            Use the guided cards below to understand opportunities, pickups, messaging, and CO2 impact.
            If you need direct help, contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="help-inline-link">
              {SUPPORT_EMAIL}
            </a>.
          </p>
        </div>

        <div className="help-hero-contact-card">
          <div className="help-hero-contact-head">
            <TopicIcon icon="mail" />
            <div>
              <span className="help-card-kicker">Official contact</span>
              <strong>{SUPPORT_EMAIL}</strong>
            </div>
          </div>
          <p>
            Reach out for account help, pickup support, opportunity guidance, or general platform questions.
          </p>
          <ActionButton
            as="a"
            href={`mailto:${SUPPORT_EMAIL}`}
            icon={null}
            tone="primary"
            minWidth={176}
          >
            Email Support
          </ActionButton>
        </div>
      </section>

      <section className="help-faq">
        <div className="page-header-wrapper left help-section-head">
          <h2 className="page-header">Guided Questions</h2>
          <p className="page-subtitle">Open any question and move through the flow card by card.</p>
        </div>

        <div className="help-topic-list">
          {HELP_TOPICS.map((topic) => {
            const isOpen = openTopicId === topic.id;
            const activeStepIndex = stepIndexMap[topic.id] || 0;
            const activeStep = topic.steps[activeStepIndex];
            const isFirstStep = activeStepIndex === 0;
            const isLastStep = activeStepIndex === topic.steps.length - 1;

            return (
              <article key={topic.id} className={`help-topic ${isOpen ? "open" : ""}`}>
                <button
                  type="button"
                  className="help-topic-toggle"
                  onClick={() => handleToggleTopic(topic.id)}
                  aria-expanded={isOpen}
                >
                  <div className="help-topic-toggle-left">
                    <div className="help-topic-icon-shell">
                      <TopicIcon icon={topic.icon} />
                    </div>
                    <div>
                      <h3>{topic.question}</h3>
                      <p>{topic.summary}</p>
                    </div>
                  </div>
                  <span className={`help-topic-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">
                    <ActionGlyph icon="arrow-right" className="help-topic-chevron-svg" />
                  </span>
                </button>

                {isOpen && (
                  <div className="help-topic-panel">
                    <div className="help-flow-rail" role="tablist" aria-label={`${topic.question} steps`}>
                      {topic.steps.map((step, index) => {
                        const isActive = index === activeStepIndex;
                        const isComplete = index < activeStepIndex;

                        return (
                          <React.Fragment key={`${topic.id}-${step.title}`}>
                            <button
                              type="button"
                              className={`help-flow-node ${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`}
                              onClick={() => updateStepIndex(topic.id, index)}
                            >
                              <span className="help-flow-node-number">{String(index + 1).padStart(2, "0")}</span>
                              <span className="help-flow-node-title">{step.title}</span>
                            </button>
                            {index < topic.steps.length - 1 && <span className="help-flow-arrow" aria-hidden="true">→</span>}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    <div className="help-flow-card">
                      <div className="help-flow-card-icon">
                        <TopicIcon icon={activeStep.icon} />
                      </div>
                      <div className="help-flow-card-copy">
                        <span className="help-card-kicker">
                          Step {activeStepIndex + 1} of {topic.steps.length}
                        </span>
                        <h4>{activeStep.title}</h4>
                        <p>{activeStep.description}</p>
                      </div>
                    </div>

                    <div className="help-flow-actions">
                      <ActionButton
                        type="button"
                        icon="back"
                        tone="neutral"
                        size="sm"
                        minWidth={138}
                        onClick={() => handleStepChange(topic.id, -1)}
                        disabled={isFirstStep}
                      >
                        Previous
                      </ActionButton>
                      <ActionButton
                        type="button"
                        icon={isLastStep ? "check" : "arrow-right"}
                        tone="primary"
                        size="sm"
                        minWidth={160}
                        onClick={() => handleStepChange(topic.id, 1)}
                        disabled={isLastStep}
                      >
                        {isLastStep ? "Completed" : "Next Card"}
                      </ActionButton>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="help-feedback-section">
        <div className="page-header-wrapper left help-section-head">
          <h2 className="page-header">{isAdmin ? "User Feedback" : "Share Feedback"}</h2>
          <p className="page-subtitle">
            {isAdmin
              ? "Review what users are saying about support, pickups, and opportunities."
              : "Tell us what is working well and what we should improve next."}
          </p>
        </div>

        {isAdmin ? (
          <div className="help-feedback-admin">
            <div className="help-feedback-summary">
              <span className="help-card-kicker">Feedback inbox</span>
              <strong>{feedbackEntries.length} total submissions</strong>
              <p>Admins can review feedback here, but cannot submit feedback from admin accounts.</p>
            </div>

            {feedbackLoading ? (
              <div className="help-feedback-empty">Loading feedback...</div>
            ) : feedbackEntries.length === 0 ? (
              <div className="help-feedback-empty">No user feedback has been submitted yet.</div>
            ) : (
              <div className="help-feedback-grid">
                {feedbackEntries.map((entry) => (
                  <article key={entry._id} className="help-feedback-card">
                    <div className="help-feedback-card-head">
                      <div>
                        <span className="help-feedback-user">@{entry.username}</span>
                        <strong>User feedback</strong>
                      </div>
                      <FeedbackDate value={entry.createdAt} />
                    </div>
                    <p>{entry.feedback}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="help-feedback-form-shell">
            <div className="help-feedback-note">
              <span className="help-card-kicker">Signed in as</span>
              <strong>@{me?.username || "user"}</strong>
              <p>Your feedback is stored with your username so admin can review it clearly.</p>
            </div>

            <div className="help-feedback-form">
              <label htmlFor="support-feedback-input">Your feedback</label>
              <textarea
                id="support-feedback-input"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Share ideas, report confusion, or tell us what should be improved."
                maxLength={2000}
              />
              <div className="help-feedback-form-footer">
                <span>{String(feedback.length || 0)}/2000</span>
                <ActionButton
                  type="button"
                  icon="check"
                  tone="primary"
                  minWidth={188}
                  onClick={handleFeedbackSubmit}
                  disabled={submitFeedbackMutation.isPending}
                >
                  {submitFeedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
                </ActionButton>
              </div>
            </div>
          </div>
        )}
      </section>

      {notification.open && (
        <MessageBox
          message={notification.message}
          type={notification.type}
          closing={notification.closing}
        />
      )}
    </div>
  );
};

export default HelpSupport;
