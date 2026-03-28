import React from "react";
import styled from "styled-components";

const PageNotFound = () => {
  return (
    <StyledWrapper>
      <div className="page-not-found-container">
        <div className="page-not-found-brand">
          <lord-icon
            src="https://cdn.lordicon.com/zruuduya.json"
            trigger="hover"
            colors="primary:#121331,secondary:#08C18A"
            style={{ width: "56px", height: "56px" }}
          ></lord-icon>
          <span className="page-not-found-brand-text">WasteZero</span>
        </div>

        <div className="card">
          <div className="orb orb--1" />
          <div className="orb orb--2" />
          <div className="orb orb--3" />
          <div className="orb orb--4" />

          <div className="error-container">
            <div className="error-code">404</div>
            <div className="error-msg">Nothing to see here.</div>
            <a href="/" className="home-btn">
              Go Home
            </a>
          </div>

          <div className="duck__wrapper">
            <div className="duck">
              <div className="duck__inner">
                <div className="duck__mouth" />
                <div className="duck__head">
                  <div className="duck__eye" />
                  <div className="duck__white" />
                </div>
                <div className="duck__body" />
                <div className="duck__wing" />
              </div>
              <div className="duck__foot duck__foot--1" />
              <div className="duck__foot duck__foot--2" />
              <div className="surface" />
            </div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .page-not-found-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    gap: 24px;
    padding: 32px 20px;
  }

  .page-not-found-brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .page-not-found-brand-text {
    font-size: 2.75rem;
    font-weight: 800;
    line-height: 1;
    color: #121331;
    letter-spacing: -1px;
  }

  .card {
    --bg-gradient: #08c18a;
    --duck-body: #f4f4f5;
    --duck-wing: #e4e4e7;
    --duck-beak: #ff3b30;
    --duck-feet: #ff9f0a;
    --duck-eye: #18181b;
    --base-speed: 1s;
    --turbo-speed: 0.3s;

    position: relative;
    width: 100%;
    max-width: 600px;
    height: 500px;
    background: var(--bg-gradient);
    border-radius: 24px;
    box-shadow:
      0 20px 50px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.3s ease;
  }

  .card:hover {
    transform: translateY(-5px);
    --base-speed: var(--turbo-speed);
  }

  .card:hover .error-code {
    color: rgba(255, 255, 255, 0.1);
  }

  .card .error-container {
    text-align: center;
    z-index: 10;
    margin-bottom: 2rem;
    pointer-events: none;
  }

  .card .error-code {
    font-size: 10rem;
    font-weight: 800;
    color: rgba(0, 0, 0, 0.1);
    line-height: 0.8;
    transition: color 0.3s ease;
    letter-spacing: -5px;
  }

  .card .error-msg {
    font-size: 1.5rem;
    font-weight: 600;
    color: #fff;
    margin-top: -20px;
    margin-bottom: 2rem;
    letter-spacing: -0.5px;
  }

  .card .home-btn {
    pointer-events: auto;
    display: inline-block;
    padding: 14px 32px;
    background-color: #fff;
    color: #000;
    font-weight: 700;
    text-decoration: none;
    border-radius: 12px;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  .card .home-btn:hover {
    background-color: var(--duck-beak);
    color: #fff;
    transform: scale(1.05);
  }

  .card .duck__wrapper {
    display: grid;
    place-content: center;
    z-index: 5;
    transform: scale(0.85);
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .card:hover .duck__wrapper {
    transform: scale(0.85) rotate(5deg) translateX(20px);
  }

  .card .duck {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .card .duck__inner {
    display: flex;
    flex-direction: column;
    position: relative;
    animation: bird-up-down calc(var(--base-speed) / 2) linear infinite;
  }

  .card .duck__head {
    align-self: flex-end;
    width: 6rem;
    height: 4rem;
    border-radius: 8rem 8rem 0 0;
    background-color: var(--duck-body);
    position: relative;
    z-index: 1;
  }

  .card .duck__head::after,
  .card .duck__head::before {
    content: "";
    position: absolute;
    border-radius: 1rem;
    background-color: var(--duck-body);
    width: 0.4rem;
    height: 2rem;
    top: 0;
  }

  .card .duck__head::after {
    left: 44%;
    transform: translate(-50%, -50%) rotate(-30deg);
  }

  .card .duck__head::before {
    left: 45%;
    transform: translate(-50%, -50%) rotate(10deg);
  }

  .card .duck__white {
    position: absolute;
    top: 0.8rem;
    left: 0.8rem;
    width: 0.6rem;
    height: 1.3rem;
    transform: rotate(40deg);
    border-radius: 50%;
    border-left: 0.2rem solid rgba(255, 255, 255, 0.8);
  }

  .card .duck__eye {
    position: absolute;
    bottom: 0.2rem;
    right: 1rem;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    background-color: var(--duck-eye);
    animation: eye-animation 2s infinite linear;
  }

  .card .duck__mouth {
    position: absolute;
    right: 0;
    top: 40%;
    width: 1rem;
    height: 1.2rem;
    transform: translate(90%, -50%);
    clip-path: polygon(0 0, 100% 40%, 100% 60%, 0% 100%);
    border-radius: 0 1rem 1rem 0;
    background-color: var(--duck-beak);
  }

  .card .duck__body {
    width: 9.5rem;
    height: 5rem;
    border-radius: 1rem 0 16rem 16rem;
    background-color: var(--duck-body);
    position: relative;
    overflow: hidden;
  }

  .card .duck__body::after {
    content: "";
    position: absolute;
    width: 105%;
    height: 200%;
    left: 50%;
    top: -95%;
    transform: translate(-50%, 0.02rem) rotate(-6deg);
    border-radius: 50%;
    border-bottom: 1rem solid #e4e4e7;
  }

  .card .duck__wing {
    position: absolute;
    left: 0.6rem;
    top: 55%;
    width: 4rem;
    height: 2.4rem;
    border-radius: 1rem 1rem 4rem 4rem;
    background-color: var(--duck-wing);
    transform: translate(0, -50%);
    transform-origin: right;
    animation: wing-animation var(--base-speed) linear infinite;
    z-index: 1;
  }

  .card .duck__foot {
    position: absolute;
    width: 0.6rem;
    height: 2rem;
    background-color: var(--duck-feet);
    z-index: -1;
  }

  .card .duck__foot::after {
    content: "";
    position: absolute;
    width: 2rem;
    height: 0.6rem;
    bottom: 0;
    left: -0.5rem;
    background-color: var(--duck-feet);
    border-radius: 1rem;
  }

  .card .duck__foot--1,
  .card .duck__foot--2 {
    left: 40%;
    bottom: 0;
    transform: translate(-50%, 80%);
  }

  .card .duck__foot--1 {
    animation: foot-ans var(--base-speed) linear infinite;
  }

  .card .duck__foot--2 {
    animation: foot-ans var(--base-speed) calc(var(--base-speed) / 2) linear infinite;
  }

  .card .surface {
    position: absolute;
    bottom: -1.9rem;
    left: 55%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.2);
    width: 8rem;
    height: 0.5rem;
    border-radius: 1rem;
    animation: surface-animation calc(var(--base-speed) / 2) linear infinite;
    filter: blur(2px);
  }

  .card .orb {
    position: absolute;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(5px);
    animation: orb-animation 8s linear infinite;
  }

  .card:hover .orb {
    width: 150px !important;
    height: 2px !important;
    border-radius: 2px;
    background-color: rgba(255, 255, 255, 0.2);
    animation-duration: 0.5s;
  }

  .card .orb--1 {
    top: 10%;
    width: 40px;
    height: 40px;
    animation-delay: 0s;
  }

  .card .orb--2 {
    top: 30%;
    width: 20px;
    height: 20px;
    animation-delay: -2s;
  }

  .card .orb--3 {
    top: 60%;
    width: 60px;
    height: 60px;
    animation-delay: -4s;
  }

  .card .orb--4 {
    top: 80%;
    width: 30px;
    height: 30px;
    animation-delay: -6s;
  }

  @media (max-width: 640px) {
    .page-not-found-brand {
      gap: 10px;
    }

    .page-not-found-brand-text {
      font-size: 2.1rem;
    }
  }

  @keyframes surface-animation {
    0%,
    100% {
      transform: translateX(-50%) scaleX(0.9);
    }
    50% {
      transform: translateX(-50%) scaleX(1);
    }
  }

  @keyframes foot-ans {
    0% {
      transform: translate(-50%, 80%) rotate(0deg);
    }
    10% {
      transform: translate(-150%, 80%) rotate(10deg);
    }
    20% {
      transform: translate(-150%, 10%) rotate(10deg);
    }
    40% {
      transform: translate(400%, 10%) rotate(-20deg);
    }
    60% {
      transform: translate(600%, 60%) rotate(-20deg);
    }
    70% {
      transform: translate(500%, 60%) rotate(0deg);
    }
  }

  @keyframes bird-up-down {
    0%,
    100% {
      transform: translateY(0.4rem);
    }
    50% {
      transform: translateY(0);
    }
  }

  @keyframes wing-animation {
    0%,
    100% {
      transform: translate(0, -50%) rotate(16deg);
    }
    50% {
      transform: translate(0, -50%) rotate(-2deg);
    }
  }

  @keyframes eye-animation {
    0%,
    20% {
      transform: scaleY(1);
    }
    10% {
      transform: scaleY(0);
    }
  }

  @keyframes orb-animation {
    0% {
      transform: translateX(650px);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateX(-200px);
      opacity: 0;
    }
  }
`;

export default PageNotFound;
