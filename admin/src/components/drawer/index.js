import React from "react";
import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { useSelector } from "react-redux";

export default () => {
  const user = useSelector((state) => state.Auth.user);

  if (!user) return <div />;

  return (
    <Sidebar onClick={() => {}} id="drawer">
      <ul>
        <li>
          <NavLink to="/dashboard">Tableau de bord</NavLink>
        </li>
        {/* <li>
          <NavLink to="/structure">Structures</NavLink>
        </li>
        <li>
          <NavLink to="/mission">Missions</NavLink>
        </li> */}
        {user.role === "admin" && (
          <li>
            <NavLink to="/user">Utilisateurs</NavLink>
          </li>
        )}
        {/*   <li>
          <NavLink to="/tuteur">Tuteurs</NavLink>
        </li> */}
        <li>
          <NavLink to="/volontaire">Volontaires</NavLink>
        </li>
        <li>
          <NavLink to="/inscription">Candidature</NavLink>
        </li>
      </ul>
      {/* <Version>
        <a href="#" className="info help">
          Centre d’aide
        </a>
        <a href="#" className="info new">
          Nouveautés
        </a>
      </Version> */}
    </Sidebar>
  );
};

const Sidebar = styled.div`
  background-color: #372f78;
  width: 250px;
  position: fixed;
  top: 68px;
  bottom: 0;
  left: 0;
  z-index: 1;
  ul {
    list-style: none;
    a {
      text-decoration: none;
      padding: 15px 20px;
      display: block;
      color: #fff;
      font-weight: 400;
      font-size: 16px;
      border-bottom: 1px solid rgba(82, 69, 204, 0.5);
      transition: 0.2s;
    }
    a.active {
      font-weight: 700;
      background: #5245cc;
      box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.1);
    }
    a:hover {
      background: #5245cc;
      box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.1);
    }
  }
  .has-child ul {
    display: none;
    a {
      padding-left: 40px;
    }
  }
  .has-child.open ul {
    display: block;
  }
`;

const Version = styled.div`
  position: absolute;
  left: 0;
  bottom: 0;
  padding: 30px 20px 10px;
  width: 100%;
  background: linear-gradient(180deg, #261f5b 0%, #372f78 29.33%);
  box-shadow: 0px -1px 0px #0e308a;
  display: flex;
  flex-direction: column;
  .info {
    color: #fff;
    font-size: 16px;
    padding-left: 40px;
    margin-bottom: 15px;
    text-decoration: none;
    background-position: left center;
    background-size: 20px;
    background-repeat: no-repeat;
  }
  .help {
    background-image: url(${require("../../assets/help.svg")});
  }
  .new {
    background-image: url(${require("../../assets/new.svg")});
  }
`;
