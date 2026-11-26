FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY workspace/Directory.Build.props workspace/Directory.Packages.props workspace/BusTicketPlatform.sln ./workspace/
COPY workspace/src ./workspace/src
COPY docs ./docs
WORKDIR /src/workspace
ARG PROJECT
RUN dotnet restore "$PROJECT"
RUN dotnet publish "$PROJECT" -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
RUN install -d -m 0700 -o "$APP_UID" /var/lib/pbl6/retention
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet"]
