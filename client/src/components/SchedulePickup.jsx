import React, { useState } from "react";
import "../styles/NavbarComponents-styles/SchedulePickup.css";

const SchedulePickup = () => {

  const [activeTab, setActiveTab] = useState("new");
  const [step, setStep] = useState(1);

  const wasteTypes = [
    "Plastic",
    "Glass",
    "Paper",
    "Electronic Waste",
    "Organic Waste",
    "Metal",
    "Other"
  ];

  const historyData = [
    {
      date: "April 23, 2024",
      address: "123 Beach Road, Vizag",
      waste: "Plastic, Organic Waste",
      status: "Completed"
    },
    {
      date: "April 20, 2024",
      address: "456 Ocean Drive, Vizag",
      waste: "Paper, Glass",
      status: "Completed"
    },
    {
      date: "April 12, 2024",
      address: "12 Hilltop Street, Vizag",
      waste: "Paper, Glass",
      status: "Scheduled"
    }
  ];

  return (
    <div className="page">
      <h2>Request Waste Collection</h2>
      <p>Request waste collection and manage your pickups.</p>

      <div className="Schedule-card">

        {/* Tabs */}
        <div className="Schedule-optins">
          <div
            className={activeTab === "new" ? "active-tab" : ""}
            onClick={() => setActiveTab("new")}
          >
            Schedule New Pickup
          </div>

          <div
            className={activeTab === "history" ? "active-tab" : ""}
            onClick={() => setActiveTab("history")}
          >
            Pickup History
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="tab-content">

          {/* ================= SCHEDULE NEW PICKUP ================= */}
          {activeTab === "new" && (
            <div className="fade-content">

              {/* STEP 1 */}
              {step === 1 && (
                <div className="step">
                  <h3>Request Waste Collection</h3>
                  <h5>Step 1 of 2</h5>

                  <div className="form_1">
                    <label>
                      Address
                      <input type="text" placeholder="Enter street address" />
                    </label>

                    <label>
                      City
                      <input type="text" />
                    </label>

                    <label>
                      Pickup Date
                      <input type="date" />
                    </label>

                    <label>
                      Preferred Time Slot
                      <input type="time" />
                    </label>
                  </div>

                  <div className="next_step">
                    <button
                      className="primary-btn"
                      onClick={() => setStep(2)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="step">
                  <h3>Type of Waste</h3>
                  <p>Select the type of waste to recycle</p>

                  <div className="waste-options">
                    {wasteTypes.map((item, index) => (
                      <label key={index} className="waste-card-option">
                        <input type="checkbox" />
                        <span className="custom-check"></span>
                        {item}
                      </label>
                    ))}
                  </div>

                  <div className="notes-section">
                    <label>Additional Notes</label>
                    <textarea placeholder="Enter description..." />
                  </div>

                  <div className="next_step">
                    <button
                      className="secondary-btn"
                      onClick={() => setStep(1)}
                    >
                      ← Previous
                    </button>

                    <button className="primary-btn">
                      Submit
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ================= PICKUP HISTORY ================= */}
          {activeTab === "history" && (
            <div className="fade-content">

              <h3>Pickup History</h3>

              <div className="history-table">

                <div className="table-header">
                  <span>Date</span>
                  <span>Address</span>
                  <span>Waste Types</span>
                  <span>Status</span>
                </div>

                {historyData.map((item, index) => (
                  <div key={index} className="table-row">
                    <span>{item.date}</span>
                    <span>{item.address}</span>
                    <span>{item.waste}</span>
                    <span>
                      <span
                        className={
                          item.status === "Completed"
                            ? "status completed"
                            : "status scheduled"
                        }
                      >
                        {item.status}
                      </span>
                    </span>
                  </div>
                ))}

              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SchedulePickup;
