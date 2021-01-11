import React from "react";
import { FormGroup, Row, Col } from "reactstrap";
import { Formik, Field } from "formik";
import validator from "validator";
import { Link, Redirect } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toastr } from "react-redux-toastr";
import styled from "styled-components";

import { setUser, setStructure } from "../../redux/auth/actions";

import api from "../../services/api";
import LoadingButton from "../../components/loadingButton";

export default () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.Auth.user);

  return (
    <Wrapper noGutters>
      <Col sm={6}>
        <AuthWrapper>
          <div style={{ marginBottom: 60 }}>
            <img src={require("../../assets/logo-snu.png")} width={100} />
          </div>
          <Title>Bienvenue !</Title>
          {user && <Redirect to="/" />}
          <Formik
            initialValues={{}}
            onSubmit={async (values, actions) => {
              try {
                const { user, token } = await api.post(`/referent/signin`, values);
                if (token) api.setToken(token);
                if (user) dispatch(setUser(user));
              } catch (e) {
                if (e && e.code === "EMAIL_OR_PASSWORD_INVALID") return toastr.error("Email ou mot de passe invalide");
             
                toastr.error("Erreur détecté");
              }
              actions.setSubmitting(false);
            }}
          >
            {({ values, errors, isSubmitting, handleChange, handleSubmit }) => {
              return (
                <form onSubmit={handleSubmit}>
                  <StyledFormGroup>
                    <label>ADRESSE EMAIL</label>
                    <InputField
                      validate={(v) => !validator.isEmail(v) && "Veuillez renseigner votre email"}
                      name="email"
                      type="email"
                      value={values.email}
                      onChange={handleChange}
                      placeholder="EMAIL"
                      hasError={errors.email}
                    />
                    <p style={{ fontSize: 12, color: "rgb(253, 49, 49)" }}>{errors.email}</p>
                  </StyledFormGroup>
                  <StyledFormGroup>
                    <label>MOT DE PASSE</label>
                    <InputField
                      validate={(v) => validator.isEmpty(v) && "Ce champ est requis"}
                      name="password"
                      type="password"
                      value={values.password}
                      onChange={handleChange}
                      placeholder="Entrez votre mot de passe"
                      hasError={errors.password}
                    />
                    <p style={{ fontSize: 12, color: "rgb(253, 49, 49)" }}>{errors.password}</p>
                  </StyledFormGroup>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 40 }}>
                    <Submit loading={isSubmitting} type="submit" color="primary">
                      Se connecter
                    </Submit>
                    <div style={{ textAlign: "right", fontSize: 14, textDecoration: "underline" }}>
                      <Link to="/auth/forgot">Mot de passe oublié ?</Link>
                    </div>
                  </div>
                  {/* <Account>
                    Pas encore de compte ? <Link to="/auth/signup">Créez un compte</Link>
                  </Account> */}
                </form>
              );
            }}
          </Formik>
        </AuthWrapper>
      </Col>
      <Col sm={6} style={{ background: "rgb(245, 249, 252)" }}>
        <Thumb>
          <h1>Plateforme du Service National Universel</h1>
          <img src={require("../../assets/auth.png")} />
        </Thumb>
      </Col>
    </Wrapper>
  );
};

const Wrapper = styled(Row)`
  height: 100vh;
  overflow: hidden;
`;

const AuthWrapper = styled.div`
  padding: 20px;
  max-width: 380px;
  width: 100%;
  margin: 0 auto;
  overflow-y: auto;
`;

const Title = styled.div`
  color: rgb(38, 42, 62);
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 15px;
`;

const StyledFormGroup = styled(FormGroup)`
  margin-bottom: 25px;
  label {
    color: rgb(106, 111, 133);
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 700;
  }
`;

const InputField = styled(Field)`
  display: block;
  width: 100%;
  margin-bottom: 0.375rem;
  background-color: #fff;
  color: #606266;
  outline: 0;
  padding: 9px 20px;
  border-radius: 4px;
  border: 1px solid;
  border-color: ${({ hasError }) => (hasError ? "red" : "#dcdfe6")};
  ::placeholder {
    color: #d6d6e1;
  }
  :focus {
    border: 1px solid #aaa;
  }
`;

const Submit = styled(LoadingButton)`
  background-color: #3182ce;
  outline: 0;
  border: 0;
  color: #fff;
  border-radius: 4px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
  :hover {
    background-color: #5a9bd8;
  }
  :disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Account = styled.div`
  border-top: 1px solid #cbd5e0;
  padding-top: 25px;
  margin-top: 100px;
  font-size: 14px;
  color: #6a6f88;
  a {
    color: #262a3e;
    font-weight: 600;
    margin-left: 5px;
  }
`;

const Thumb = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  height: 100%;
  h1 {
    color: rgb(49, 130, 206);
    margin-bottom: 60px;
    font-size: 24px;
  }
  img {
    max-width: 280px;
  }
`;
